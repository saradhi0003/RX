/**
 * Unified LLM abstraction — provider-agnostic and key-safe.
 *
 * Security model
 *   ALL cloud-provider calls route through the Supabase Edge Function `llmProxy`
 *   so API keys never reach the browser bundle. The only client-side path that
 *   does not use the proxy is local Ollama (http://localhost:11434), which
 *   requires no API key and is intended for offline development only.
 *
 *   Do NOT add VITE_OPENAI_API_KEY, VITE_ANTHROPIC_API_KEY, or
 *   dangerouslyAllowBrowser to this file. If a page needs streaming, use
 *   invokeLLMStream; for cloud providers it currently falls back to a full
 *   proxy response (streaming through the proxy is on the roadmap).
 *
 * Usage:
 *   import { invokeLLM, invokeLLMJson, invokeLLMStream } from "@/lib/llm";
 *   const text = await invokeLLM({ prompt, system, task: "candidate_summary" });
 *   const obj  = await invokeLLMJson({ prompt, system });
 */

// @ts-ignore
const provider = import.meta.env.VITE_LLM_PROVIDER || "anthropic";
// @ts-ignore
const ollamaBase = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";

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
    // supabase-js flattens every non-2xx into "Edge Function returned a
    // non-2xx status code", discarding the body — so a real cause (bad model,
    // provider 4xx, unparseable JSON) reached callers as an unactionable
    // string. FunctionsHttpError carries the Response on `.context`; the
    // function always answers `{error: "<reason>"}` via errResponse(), so read
    // it. Without this the only way to see why an LLM call failed is the
    // Supabase dashboard.
    let msg = error.message || "llmProxy invocation failed";
    let status = 0;
    const res = /** @type {any} */ (error).context;
    if (res && typeof res.json === "function") {
      status = res.status || 0;
      try {
        const body = await res.clone().json();
        if (body?.error) msg = body.error;
      } catch { /* non-JSON body — keep the generic message */ }
    }

    if (status === 404 || /404|not found/i.test(msg)) {
      throw new Error(
        `llmProxy Edge Function is not deployed. Deploy it with: supabase functions deploy llmProxy && supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=...`
      );
    }
    if (status === 429 || /cost ceiling/i.test(msg)) throw new LLMBudgetError(msg);
    throw new Error(msg);
  }
  logUsage({
    provider: "proxy",
    model: opts.model || "auto",
    prompt_tokens: 0,
    completion_tokens: 0,
    cost_usd: 0,
    latency_ms: Date.now() - t0,
    task: opts.task,
  });
  return data?.text ?? "";
}

// ── Cost tracking (fire-and-forget, never throws) ────────────────────────────
async function logUsage(usage) {
  try {
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("llm_usage").insert({
      provider: usage.provider || "unknown",
      model: usage.model || "unknown",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      cost_usd: usage.cost_usd || 0,
      latency_ms: usage.latency_ms || 0,
      task: usage.task || "unknown",
    });
  } catch {
    // intentionally silent — logging must never break callers
  }
}

// ── Ollama (local dev only — no API key required) ──────────────────────────
async function callOllama({ prompt, system, model = "llama3.2", temperature = 0.3, task }) {
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

async function callOllamaStream({ prompt, system, model = "llama3.2", temperature = 0.3 }, onChunk) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
  });
  if (!res.ok) throw new Error(`Ollama stream error: ${res.statusText}`);

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let full = "";
  if (!reader) return full;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const delta = parsed.message?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta, full);
        }
      } catch {
        // partial JSON — skip
      }
    }
  }
  return full;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry — routes cloud providers through llmProxy so keys stay server-side.
 * Use VITE_LLM_PROVIDER=ollama for offline local development.
 */
export async function invokeLLM(opts) {
  if (provider === "ollama") return callOllama(opts);
  return callProxy(opts);
}

/**
 * Streaming entry. For local Ollama this is a true stream; for cloud providers
 * the proxy currently returns the full response, so onChunk is called once.
 */
export async function invokeLLMStream(opts, onChunk) {
  if (provider === "ollama") return callOllamaStream(opts, onChunk);
  const text = await callProxy(opts);
  onChunk(text, text);
  return text;
}

/**
 * Like invokeLLM but parses JSON — strips markdown fences automatically.
 */
export async function invokeLLMJson(opts) {
  const raw = await invokeLLM({ ...opts, response_format: "json" });
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}
