import OpenAI from "npm:openai@^4";
import Anthropic from "npm:@anthropic-ai/sdk@^0.39";
import { getSetting, getAISettings } from "./supabaseClient.ts";
import {
  hasOpenAI,
  getOpenAIKey,
  hasAnthropic,
  getAnthropicKey,
  getOllamaBaseUrl,
  hasDeepSeek,
  getDeepSeekKey,
  getDeepSeekBaseUrl,
  hasDashScope,
  getDashScopeKey,
  getDashScopeBaseUrl,
  hasOpenAICompatible,
  getOpenAICompatibleEnv,
  readOpenAICompatibleBaseUrl,
  readOpenAICompatibleApiKey,
} from "./env.ts";
import { estimateCost } from "./pricing.ts";
import { DEFAULT_WORKSPACE_ID } from "./auth.ts";
import {
  detectProvider,
  isLocalModel,
  stripLocalPrefix,
  fallbackCandidates,
} from "./modelRouting.ts";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface LLMResult {
  text: string;
  model: string;
  provider: string;
  usage: Usage;
}

// ── Daily cost ceiling (StockAnalysis *_COST_CEILING pattern) ───────────────
// One cheap llm_usage sum per function invocation — call at entry points
// (llmProxy, aiRecruiter* sweeps), not per LLM call. Fail-open on read error.
const DAILY_CEILING_USD = Number(Deno.env.get("LLM_DAILY_COST_CEILING_USD") || "10");

export async function checkDailyCeiling(): Promise<{ ok: boolean; spent: number; ceiling: number }> {
  try {
    const { supabase } = await import("./supabaseClient.ts");
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("llm_usage")
      .select("cost_usd")
      .gte("created_at", midnight.toISOString());
    if (error) return { ok: true, spent: 0, ceiling: DAILY_CEILING_USD };
    const spent = (data ?? []).reduce((s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0), 0);
    return { ok: spent < DAILY_CEILING_USD, spent, ceiling: DAILY_CEILING_USD };
  } catch {
    return { ok: true, spent: 0, ceiling: DAILY_CEILING_USD };
  }
}

// Per-request input cap — a runaway context (unbounded resume/job text) is the
// other spend failure mode besides call volume. ~4 chars/token heuristic.
const MAX_PROMPT_CHARS = Number(Deno.env.get("LLM_MAX_PROMPT_CHARS") || "48000");

/** Route to the correct LLM provider based on model name or explicit provider override */
export async function invokeLLM(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null,
  opts: { task?: string; userEmail?: string; sessionId?: string; workspaceId?: string } = {}
): Promise<string> {
  const totalChars = (userPrompt?.length || 0) + (systemPrompt?.length || 0);
  if (totalChars > MAX_PROMPT_CHARS) {
    throw new Error(
      `Prompt too large: ${totalChars} chars exceeds LLM_MAX_PROMPT_CHARS=${MAX_PROMPT_CHARS}. ` +
      "Truncate the context before calling the LLM.",
    );
  }
  const resolvedModel = model || (await getSetting("llm_default_model")) || "deepseek-chat";

  // Enterprise-grade resilience: if the primary model fails (tunnel down, key
  // expired, provider 5xx), walk the cost-ordered fallback chain
  // (DeepSeek → Qwen → Anthropic), skipping providers with no credentials.
  // The first success wins; the usage log below records which model actually
  // served, so fallback spend is still visible against the daily ceiling.
  const candidates = [
    resolvedModel,
    ...fallbackCandidates(resolvedModel, {
      deepseek: hasDeepSeek(),
      dashscope: hasDashScope(),
      anthropic: hasAnthropic(),
    }),
  ];
  let result: LLMResult | null = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      result = await callProvider(systemPrompt, userPrompt, candidate);
      if (candidate !== resolvedModel) {
        console.warn(
          `[llm] primary "${resolvedModel}" failed — served by fallback "${candidate}" (task=${opts.task || "unknown"})`,
        );
      }
      break;
    } catch (err) {
      lastError = err;
      console.warn(
        `[llm] model "${candidate}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!result) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  // Cost logging is best-effort; it must never break the caller.
  try {
    const cost_usd = estimateCost(result.model, result.usage.prompt_tokens, result.usage.completion_tokens);
    const { supabase } = await import("./supabaseClient.ts");
    const { error: usageError } = await supabase.from("llm_usage").insert({
      provider: result.provider,
      model: result.model,
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      cost_usd,
      latency_ms: 0,
      task: opts.task || "unknown",
      user_email: opts.userEmail || null,
      session_id: opts.sessionId || null,
      // REQUIRED. llm_usage.workspace_id is NOT NULL with no default, and the
      // service-role client this module uses has no auth.uid() — so
      // stamp_workspace_id()'s auth_workspace_id() lookup returns NULL and
      // every insert died on the constraint. The bare `catch {}` below then
      // swallowed it, so nothing was written to llm_usage for ~a month while
      // llmProxy kept reporting usage_logged:true. That also silently
      // disabled the spend guard: checkDailyCeiling() sums this table, so an
      // empty table reads as $0 spent and the ceiling can never trigger.
      // This is the service-role rule in functions/CLAUDE.md — any INSERT
      // into a tenant table must set workspace_id explicitly.
      workspace_id: opts.workspaceId || DEFAULT_WORKSPACE_ID,
    });
    if (usageError) {
      // Still non-fatal, but no longer invisible — a broken spend ledger is
      // exactly the kind of thing that must not fail quietly.
      console.error("[llm] usage logging failed:", usageError.message);
    }
  } catch (err) {
    console.error("[llm] usage logging threw:", err instanceof Error ? err.message : String(err));
  }

  return result.text;
}

/** Like invokeLLM but instructs the model to respond with valid JSON and parses it */
export async function invokeLLMJson<T = unknown>(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null,
  opts: { task?: string; userEmail?: string; sessionId?: string; workspaceId?: string } = {}
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no prose.`;
  const raw = await invokeLLM(userPrompt, jsonSystemPrompt, model, opts);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

// Provider selection lives in modelRouting.ts so `npm test` can cover it —
// this module's npm: imports are invisible to Vitest.

async function callProvider(system: string, user: string, model: string): Promise<LLMResult> {
  const provider = detectProvider(model);
  if (provider === "anthropic") return callAnthropic(system, user, model);
  if (provider === "ollama") return callOllama(system, user, model);
  if (provider === "openai-compatible") return callOpenAICompatible(system, user, model);
  return callOpenAI(system, user, model);
}

async function callOpenAI(system: string, user: string, model: string): Promise<LLMResult> {
  const apiKey = hasOpenAI() ? getOpenAIKey() : await getSetting("openai_key");
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    model,
    provider: "openai",
    usage: {
      prompt_tokens: res.usage?.prompt_tokens || 0,
      completion_tokens: res.usage?.completion_tokens || 0,
    },
  };
}

async function callAnthropic(system: string, user: string, model: string): Promise<LLMResult> {
  const apiKey = hasAnthropic() ? getAnthropicKey() : await getSetting("anthropic_key");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content[0];
  const text = block.type === "text" ? block.text : "";
  return {
    text,
    model,
    provider: "anthropic",
    usage: {
      prompt_tokens: res.usage?.input_tokens || 0,
      completion_tokens: res.usage?.output_tokens || 0,
    },
  };
}

async function callOllama(system: string, user: string, model: string): Promise<LLMResult> {
  const base = getOllamaBaseUrl();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
  const json = await res.json();
  return {
    text: json.message?.content ?? "",
    model,
    provider: "ollama",
    usage: {
      prompt_tokens: json.prompt_eval_count || 0,
      completion_tokens: json.eval_count || 0,
    },
  };
}

async function callOpenAICompatible(system: string, user: string, model: string): Promise<LLMResult> {
  let baseURL: string;
  let apiKey: string;
  let resolvedModel = model;

  // What goes in llm_usage. For the local fleet this stays `local/…` even
  // though the wire carries the bare id, so pricing.ts prices it at zero
  // instead of guessing from the family name.
  let reportedModel = model;

  const lower = model.toLowerCase();
  if (isLocalModel(lower)) {
    // The LM Studio fleet, reached through scripts/tunnel-lmstudio.sh. The
    // "API key" is the gateway's shared secret; the gateway 401s without it.
    const aiSettings = await getAISettings();
    baseURL = readOpenAICompatibleBaseUrl() || aiSettings?.openai_compatible_base_url || "";
    apiKey = readOpenAICompatibleApiKey();
    if (!baseURL) {
      throw new Error(
        `Model "${model}" targets the local fleet, but no tunnel is configured. ` +
        "Run ./scripts/tunnel-lmstudio.sh and set OPENAI_COMPATIBLE_BASE_URL " +
        "(plus OPENAI_COMPATIBLE_API_KEY) as Edge Function secrets.",
      );
    }
    if (!apiKey) {
      // Failing here rather than sending an empty bearer keeps the cause
      // legible: an unauthenticated call would come back as a bare 401 from
      // the gateway and read like the tunnel was down.
      throw new Error(
        `Model "${model}" targets the local fleet, but OPENAI_COMPATIBLE_API_KEY is not set. ` +
        "It must equal the gateway secret in .lmstudio-tunnel.local.",
      );
    }
    resolvedModel = stripLocalPrefix(model);
  } else if (lower.startsWith("deepseek")) {
    if (!hasDeepSeek()) throw new Error("DEEPSEEK_API_KEY not configured");
    baseURL = getDeepSeekBaseUrl();
    apiKey = getDeepSeekKey();
  } else if (lower.startsWith("qwen") || lower.startsWith("alibaba")) {
    if (!hasDashScope()) throw new Error("DASHSCOPE_API_KEY not configured");
    baseURL = getDashScopeBaseUrl();
    apiKey = getDashScopeKey();
  } else if (lower.includes("-compatible")) {
    // Generic OpenAI-compatible endpoint: model id and base URL may be stored
    // in ai_recruiter_settings, with env vars as fallback.
    const aiSettings = await getAISettings();
    const settingsBaseURL = aiSettings?.openai_compatible_base_url || "";
    const settingsModel = aiSettings?.openai_compatible_model || "";

    let defaultModelFromEnv = "";
    if (hasOpenAICompatible()) {
      const env = getOpenAICompatibleEnv();
      baseURL = settingsBaseURL || env.baseURL;
      apiKey = env.apiKey;
      defaultModelFromEnv = env.defaultModel;
    } else if (settingsBaseURL) {
      // Settings-only config with no explicit API key secret. This is useful for
      // endpoints that do their own auth (e.g., a hosted proxy or tunnel).
      baseURL = settingsBaseURL;
      apiKey = "not-needed";
    } else {
      throw new Error(
        `No OpenAI-compatible endpoint configured for model "${model}". ` +
        "Set OPENAI_COMPATIBLE_API_KEY + OPENAI_COMPATIBLE_BASE_URL as Edge Function secrets, " +
        "or set openai_compatible_base_url in ai_recruiter_settings.",
      );
    }
    resolvedModel = settingsModel || defaultModelFromEnv || model;
  } else {
    throw new Error(
      `No OpenAI-compatible API key configured for model "${model}". ` +
      "Set DEEPSEEK_API_KEY, DASHSCOPE_API_KEY, or OPENAI_COMPATIBLE_API_KEY.",
    );
  }

  // Cloud paths bill against whatever they actually called; only the local
  // fleet keeps its prefixed id so the pricing table can zero it out.
  if (!isLocalModel(model)) reportedModel = resolvedModel;

  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.chat.completions.create({
    model: resolvedModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    model: reportedModel,
    provider: isLocalModel(model) ? "lmstudio-tunnel" : "openai-compatible",
    usage: {
      prompt_tokens: res.usage?.prompt_tokens || 0,
      completion_tokens: res.usage?.completion_tokens || 0,
    },
  };
}
