/**
 * Unified LLM abstraction — provider-agnostic.
 * Controlled by VITE_LLM_PROVIDER: "openai" | "anthropic" | "ollama"
 *
 * Security model
 *   By default invokeLLM() routes through the Supabase Edge Function `llmProxy`
 *   so API keys stay server-side. To enable direct browser calls (dev only),
 *   set VITE_LLM_DIRECT=true in .env.local.
 *
 * Enterprise features:
 *   - Fallback chain: primary → secondary → tertiary provider on failure
 *   - Streaming: invokeLLMStream(opts, onChunk) for token-by-token output
 *   - Cost tracking: logs each call to llm_usage table (non-blocking)
 *
 * Usage:
 *   import { invokeLLM, invokeLLMJson, invokeLLMStream } from "@/lib/llm";
 *   const text   = await invokeLLM({ prompt, system, temperature, max_tokens, task });
 *   const obj    = await invokeLLMJson({ prompt });
 *   const full   = await invokeLLMStream({ prompt }, (delta, accumulated) => setOutput(accumulated));
 */

// @ts-ignore
const provider    = import.meta.env.VITE_LLM_PROVIDER   || "anthropic";
// @ts-ignore
const directMode  = String(import.meta.env.VITE_LLM_DIRECT || "").toLowerCase() === "true";

/**
 * Thrown when the server-side spend ceiling rejects a call (HTTP 429 from an
 * Edge Function). Callers can `err instanceof LLMBudgetError` to show a
 * budget-specific toast instead of a generic failure.
 */
export class LLMBudgetError extends Error {
  constructor(message) {
    super(message || "LLM daily cost ceiling reached — try again tomorrow or raise the ceiling.");
    this.name = "LLMBudgetError";
  }
}

// ── Proxy path (default) — routes via Supabase Edge Function llmProxy ────────
async function callProxy(opts) {
  const { supabase } = await import("@/lib/supabase");
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke("llmProxy", { body: opts });
  if (error) {
    const msg = error.message || "llmProxy invocation failed";
    // If the function isn't deployed yet, the error has status 404. Surface
    // a clearer hint so devs know how to fix it.
    if (/404|not found/i.test(msg)) {
      throw new Error(`llmProxy Edge Function is not deployed. Deploy it with: supabase functions deploy llmProxy && supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=... — or set VITE_LLM_DIRECT=true for dev.`);
    }
    if (/429|cost ceiling/i.test(msg)) throw new LLMBudgetError(msg);
    throw new Error(msg);
  }
  logUsage({ provider: "proxy", model: opts.model || "auto", prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, latency_ms: Date.now() - t0, task: opts.task });
  return data?.text ?? "";
}
// @ts-ignore
const ollamaBase  = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
// @ts-ignore
const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL    || "llama3.2";

// Fallback chain order — primary first, then alternatives
const PROVIDER_CHAIN =
  provider === "anthropic" ? ["anthropic", "openai",    "ollama"] :
  provider === "ollama"    ? ["ollama",    "openai",    "anthropic"] :
  /* openai default */       ["openai",    "anthropic", "ollama"];

// ── Cost estimation tables (USD per 1K tokens) ─────────────────────────────
const OPENAI_RATES = {
  "gpt-4o":          { input: 0.005,   output: 0.015  },
  "gpt-4o-mini":     { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo":     { input: 0.01,    output: 0.03   },
  "gpt-4":           { input: 0.03,    output: 0.06   },
};
const ANTHROPIC_RATES = {
  "claude-haiku-4-5-20251001": { input: 0.00025,  output: 0.00125 },
  "claude-sonnet-4-6":         { input: 0.003,    output: 0.015   },
  "claude-opus-4-7":           { input: 0.005,    output: 0.025   },
  "claude-opus-4-8":           { input: 0.005,    output: 0.025   },
};

/** @param {string} model @param {number} p @param {number} c @returns {number} */
function openaiCost(model, p, c) {
  const r = OPENAI_RATES[model] || { input: 0.001, output: 0.002 };
  return (p / 1000) * r.input + (c / 1000) * r.output;
}
/** @param {string} model @param {number} p @param {number} c @returns {number} */
function anthropicCost(model, p, c) {
  const r = ANTHROPIC_RATES[model] || { input: 0.001, output: 0.003 };
  return (p / 1000) * r.input + (c / 1000) * r.output;
}

// ── Cost tracking (fire-and-forget, never throws) ──────────────────────────
/**
 * @param {{ provider: string; model: string; prompt_tokens?: number; completion_tokens?: number; cost_usd?: number; latency_ms?: number; task?: string }} usage
 */
async function logUsage(usage) {
  try {
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("llm_usage").insert({
      provider:          usage.provider,
      model:             usage.model,
      prompt_tokens:     usage.prompt_tokens     || 0,
      completion_tokens: usage.completion_tokens || 0,
      cost_usd:          usage.cost_usd          || 0,
      latency_ms:        usage.latency_ms        || 0,
      task:              usage.task              || "unknown",
    });
  } catch {
    // intentionally silent — logging must never break callers
  }
}

// ── OpenAI ─────────────────────────────────────────────────────────────────
/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number; response_format?: string; task?: string }} opts
 * @returns {Promise<string>}
 */
async function callOpenAI({ prompt, system, model = "gpt-4o-mini", temperature = 0.3, max_tokens = 2000, response_format, task }) {
  const { OpenAI } = await import("openai");
  // @ts-ignore
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  /** @type {any[]} */
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  /** @type {any} */
  const params = { model, messages, temperature, max_tokens };
  if (response_format === "json") params.response_format = { type: "json_object" };

  const t0 = Date.now();
  const res = await client.chat.completions.create(/** @type {any} */ (params));
  const latency_ms = Date.now() - t0;

  const pt = res.usage?.prompt_tokens     || 0;
  const ct = res.usage?.completion_tokens || 0;
  logUsage({ provider: "openai", model, prompt_tokens: pt, completion_tokens: ct, cost_usd: openaiCost(model, pt, ct), latency_ms, task });

  return res.choices[0].message.content ?? "";
}

/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number }} opts
 * @param {(delta: string, accumulated: string) => void} onChunk
 * @returns {Promise<string>}
 */
async function callOpenAIStream({ prompt, system, model = "gpt-4o-mini", temperature = 0.3, max_tokens = 2000 }, onChunk) {
  const { OpenAI } = await import("openai");
  // @ts-ignore
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  /** @type {any[]} */
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const stream = await client.chat.completions.create(/** @type {any} */ ({
    model, messages, temperature, max_tokens, stream: true,
  }));

  let full = "";
  for await (const chunk of /** @type {any} */ (stream)) {
    const delta = chunk.choices?.[0]?.delta?.content || "";
    if (delta) { full += delta; onChunk(delta, full); }
  }
  return full;
}

// ── Anthropic ──────────────────────────────────────────────────────────────
/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number; task?: string }} opts
 * @returns {Promise<string>}
 */
async function callAnthropic({ prompt, system, model = "claude-opus-4-8", temperature = 0.3, max_tokens = 2000, task }) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  // @ts-ignore
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const t0 = Date.now();
  const res = await client.messages.create({
    model, max_tokens, temperature,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  const latency_ms = Date.now() - t0;

  const pt = res.usage?.input_tokens  || 0;
  const ct = res.usage?.output_tokens || 0;
  logUsage({ provider: "anthropic", model, prompt_tokens: pt, completion_tokens: ct, cost_usd: anthropicCost(model, pt, ct), latency_ms, task });

  const block = res.content[0];
  return block.type === "text" ? block.text : "";
}

/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number }} opts
 * @param {(delta: string, accumulated: string) => void} onChunk
 * @returns {Promise<string>}
 */
async function callAnthropicStream({ prompt, system, model = "claude-opus-4-8", temperature = 0.3, max_tokens = 2000 }, onChunk) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  // @ts-ignore
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model, max_tokens, temperature,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  let full = "";
  for await (const event of /** @type {any} */ (stream)) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      const delta = event.delta.text || "";
      if (delta) { full += delta; onChunk(delta, full); }
    }
  }
  return full;
}

// ── Ollama (local) ─────────────────────────────────────────────────────────
/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; task?: string }} opts
 * @returns {Promise<string>}
 */
async function callOllama({ prompt, system, model = ollamaModel, temperature = 0.3, task }) {
  /** @type {any[]} */
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const t0 = Date.now();
  const res = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
  const json = await res.json();
  const latency_ms = Date.now() - t0;
  const text = json.message?.content || "";

  logUsage({ provider: "ollama", model, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, latency_ms, task });
  return text;
}

/**
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number }} opts
 * @param {(delta: string, accumulated: string) => void} onChunk
 * @returns {Promise<string>}
 */
async function callOllamaStream({ prompt, system, model = ollamaModel, temperature = 0.3 }, onChunk) {
  /** @type {any[]} */
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
  });
  if (!res.ok) throw new Error(`Ollama stream error: ${res.statusText}`);

  const reader  = res.body?.getReader();
  const decoder = new TextDecoder();
  let full = "";
  if (!reader) return full;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const delta = parsed.message?.content || "";
        if (delta) { full += delta; onChunk(delta, full); }
      } catch { /* partial JSON — skip */ }
    }
  }
  return full;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Main entry — routes to configured provider with automatic fallback chain.
 * If the primary provider fails, tries the next one in PROVIDER_CHAIN.
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number; response_format?: string; task?: string }} opts
 * @returns {Promise<string>}
 */
export async function invokeLLM(opts) {
  // Default: route through Supabase Edge Function llmProxy so API keys stay
  // server-side. Dev can opt out with VITE_LLM_DIRECT=true.
  if (!directMode) {
    try {
      return await callProxy(opts);
    } catch (err) {
      // If the proxy itself failed (deploy missing / network), fall through
      // to the legacy direct-call chain so dev isn't blocked. Production
      // should NOT have direct-call fallback — guard with hostname.
      const isLocal = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname);
      if (!isLocal) throw err;
      console.warn("[LLM] proxy failed, falling back to direct call (localhost only):", err);
    }
  }

  const errors = [];
  for (const p of PROVIDER_CHAIN) {
    try {
      if (p === "anthropic") return await callAnthropic(opts);
      if (p === "ollama")    return await callOllama(opts);
      return await callOpenAI(opts);
    } catch (err) {
      const msg = /** @type {any} */ (err)?.message || String(err);
      errors.push(`[${p}] ${msg}`);
      console.warn(`[LLM] ${p} failed, trying next provider…`, err);
    }
  }
  throw new Error(`All LLM providers failed:\n${errors.join("\n")}`);
}

/**
 * Streaming entry — emits token deltas as they arrive.
 * No fallback chain for streaming (SSE state can't be rewound).
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number }} opts
 * @param {(delta: string, accumulated: string) => void} onChunk
 * @returns {Promise<string>} full accumulated text
 */
export async function invokeLLMStream(opts, onChunk) {
  if (provider === "anthropic") return callAnthropicStream(opts, onChunk);
  if (provider === "ollama")    return callOllamaStream(opts, onChunk);
  return callOpenAIStream(opts, onChunk);
}

/**
 * Like invokeLLM but parses JSON — strips markdown fences automatically.
 * @param {{ prompt: string; system?: string; model?: string; temperature?: number; max_tokens?: number }} opts
 * @returns {Promise<any>}
 */
export async function invokeLLMJson(opts) {
  const raw     = await invokeLLM({ ...opts, response_format: "json" });
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}
