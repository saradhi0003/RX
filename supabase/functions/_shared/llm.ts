import OpenAI from "npm:openai@^4";
import Anthropic from "npm:@anthropic-ai/sdk@^0.39";
import { getSetting, supabase } from "./supabaseClient.ts";
import { hasOpenAI, getOpenAIKey, hasAnthropic, getAnthropicKey, getOllamaBaseUrl } from "./env.ts";
import { estimateCost, isKnownModel } from "./pricing.ts";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Provider call result — token counts are what make the cost rail real. */
interface LLMResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  provider: "openai" | "anthropic" | "ollama";
}

/** Optional per-call metadata. Omitting it keeps the old 3-arg signature working. */
export interface LLMOptions {
  /** Cost-dashboard bucket, e.g. "match:reason", "agent:<id>:ai_analysis". */
  task?: string;
  /** REQUIRED for correct attribution — llm_usage.workspace_id is NOT NULL. */
  workspaceId?: string | null;
  /** Present when the call belongs to an agent run. */
  runId?: string | null;
}

/**
 * The workspace a call is attributed to when the caller did not supply one.
 * Mirrors DEFAULT_WORKSPACE_ID in _shared/auth.ts — kept as a literal rather
 * than imported so this module stays free of the auth import cycle.
 */
const FALLBACK_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

// ── Daily cost ceiling ──────────────────────────────────────────────────────
// Call at entry points (llmProxy, aiRecruiter* sweeps, runAgent), not per LLM
// call. Fails OPEN on read error: a monitoring failure must not take the
// product down.
const DAILY_CEILING_USD = Number(Deno.env.get("LLM_DAILY_COST_CEILING_USD") || "10");

export async function checkDailyCeiling(
  workspaceId?: string | null,
): Promise<{ ok: boolean; spent: number; ceiling: number }> {
  try {
    // Preferred path: aggregate in the database. The previous implementation
    // selected every cost_usd row for the day and summed in JS, which is both
    // O(rows) over the wire and silently truncated by PostgREST's row cap — a
    // busy day could under-count and let the ceiling slip.
    const { data, error } = await supabase.rpc("llm_spend_today", {
      p_workspace_id: workspaceId ?? null,
    });
    if (!error && data !== null && data !== undefined) {
      const spent = Number(data) || 0;
      return { ok: spent < DAILY_CEILING_USD, spent, ceiling: DAILY_CEILING_USD };
    }

    // Fallback while migration 026 (which adds llm_spend_today) is unapplied.
    // Bounded so a large day cannot blow the function's memory.
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    let q = supabase
      .from("llm_usage")
      .select("cost_usd")
      .gte("created_at", midnight.toISOString())
      .limit(10000);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);

    const { data: rows, error: rowsErr } = await q;
    if (rowsErr) return { ok: true, spent: 0, ceiling: DAILY_CEILING_USD };
    const spent = (rows ?? []).reduce(
      (s: number, r: { cost_usd: number }) => s + Number(r.cost_usd || 0),
      0,
    );
    return { ok: spent < DAILY_CEILING_USD, spent, ceiling: DAILY_CEILING_USD };
  } catch {
    return { ok: true, spent: 0, ceiling: DAILY_CEILING_USD };
  }
}

/**
 * Record one LLM call. Fire-and-forget and NEVER throws — mirrors the contract
 * of logUsage() in src/lib/llm.js. Logging must not be able to fail a request
 * that already succeeded.
 *
 * workspace_id is set explicitly: the service role bypasses RLS *and* the
 * stamp_workspace_id trigger, and llm_usage.workspace_id is NOT NULL post-024.
 */
export async function logLlmUsage(entry: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  task?: string;
  workspaceId?: string | null;
  runId?: string | null;
}): Promise<void> {
  try {
    await supabase.from("llm_usage").insert({
      provider: entry.provider,
      model: entry.model,
      prompt_tokens: entry.promptTokens || 0,
      completion_tokens: entry.completionTokens || 0,
      cost_usd: estimateCost(entry.model, entry.promptTokens, entry.completionTokens),
      latency_ms: entry.latencyMs || 0,
      task: entry.task || "unknown",
      workspace_id: entry.workspaceId || FALLBACK_WORKSPACE_ID,
    });

    if (!isKnownModel(entry.model)) {
      // Visible in function logs; the cost is still counted at DEFAULT_PRICE.
      console.warn(`[llm] no price entry for model "${entry.model}" — using fallback pricing`);
    }
  } catch (err) {
    console.warn("[llm] usage logging failed (non-fatal):", (err as Error)?.message);
  }
}

// Per-request input cap — a runaway context (unbounded resume/job text) is the
// other spend failure mode besides call volume. ~4 chars/token heuristic.
const MAX_PROMPT_CHARS = Number(Deno.env.get("LLM_MAX_PROMPT_CHARS") || "48000");

/** Route to the correct LLM provider based on model name or explicit override. */
export async function invokeLLM(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null,
  opts?: LLMOptions,
): Promise<string> {
  const totalChars = (userPrompt?.length || 0) + (systemPrompt?.length || 0);
  if (totalChars > MAX_PROMPT_CHARS) {
    throw new Error(
      `Prompt too large: ${totalChars} chars exceeds LLM_MAX_PROMPT_CHARS=${MAX_PROMPT_CHARS}. ` +
      "Truncate the context before calling the LLM.",
    );
  }
  const resolvedModel = model || (await getSetting("llm_default_model")) || "gpt-4o-mini";
  const provider = detectProvider(resolvedModel);

  const t0 = Date.now();
  let result: LLMResult;
  if (provider === "anthropic") {
    result = await callAnthropic(systemPrompt, userPrompt, resolvedModel);
  } else if (provider === "ollama") {
    result = await callOllama(systemPrompt, userPrompt, resolvedModel);
  } else {
    result = await callOpenAI(systemPrompt, userPrompt, resolvedModel);
  }

  // Logged here, inside invokeLLM, so every caller — present and future — is
  // covered without having to remember.
  await logLlmUsage({
    provider: result.provider,
    model: resolvedModel,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    latencyMs: Date.now() - t0,
    task: opts?.task,
    workspaceId: opts?.workspaceId,
    runId: opts?.runId,
  });

  return result.text;
}

/** Like invokeLLM but instructs the model to respond with valid JSON and parses it. */
export async function invokeLLMJson<T = unknown>(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null,
  opts?: LLMOptions,
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no prose.`;
  const raw = await invokeLLM(userPrompt, jsonSystemPrompt, model, opts);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function detectProvider(model: string): "openai" | "anthropic" | "ollama" {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("llama") || model.startsWith("mistral") || model.startsWith("phi")) return "ollama";
  return "openai";
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
    promptTokens: res.usage?.prompt_tokens ?? 0,
    completionTokens: res.usage?.completion_tokens ?? 0,
    provider: "openai",
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
  return {
    text: block?.type === "text" ? block.text : "",
    promptTokens: res.usage?.input_tokens ?? 0,
    completionTokens: res.usage?.output_tokens ?? 0,
    provider: "anthropic",
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
    // Ollama reports token counts as prompt_eval_count / eval_count.
    text: json.message?.content ?? "",
    promptTokens: json.prompt_eval_count ?? 0,
    completionTokens: json.eval_count ?? 0,
    provider: "ollama",
  };
}
