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

import { resolveModel, LMSTUDIO_BASE_URL } from "@/lib/llmRouter";

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

// ── LM Studio (local dev only — no API key required) ───────────────────────
// OpenAI-compatible surface at /v1, so this is a plain chat/completions call.
// With LM Link the endpoint spans every linked device: the model id chosen by
// llmRouter is what decides which machine actually serves the request.

/** Mirrors the server's invokeLLMJson — the local model needs telling too. */
const JSON_ONLY_SUFFIX =
  "\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no prose.";

function lmStudioMessages({ prompt, system, response_format }) {
  const sys = response_format === "json" ? `${system || ""}${JSON_ONLY_SUFFIX}`.trim() : system;
  const messages = [];
  if (sys) messages.push({ role: "system", content: sys });
  messages.push({ role: "user", content: prompt });
  return messages;
}

/** Turn a connection refusal into something that names the fix. */
function lmStudioUnreachable(cause) {
  return new Error(
    `Cannot reach LM Studio at ${LMSTUDIO_BASE_URL}. Open LM Studio → Developer → ` +
    `Start Server (default port 1234), or set VITE_LMSTUDIO_BASE_URL.`,
    { cause },
  );
}

async function callLMStudio(opts) {
  const { temperature = 0.3, task } = opts;
  const model = opts.model || (await resolveModel({ task }));
  const messages = lmStudioMessages(opts);

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${LMSTUDIO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });
  } catch (cause) {
    throw lmStudioUnreachable(cause);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LM Studio error ${res.status} (model "${model}"): ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage || {};

  // Record the resolved id, not "auto" — on an LM Link fleet that is also the
  // record of which device served the call.
  logUsage({
    provider: "lmstudio",
    model,
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    cost_usd: 0,
    latency_ms: Date.now() - t0,
    task,
  });
  return text;
}

async function callLMStudioStream(opts, onChunk) {
  const { temperature = 0.3, task } = opts;
  const model = opts.model || (await resolveModel({ task }));
  const messages = lmStudioMessages(opts);

  let res;
  try {
    res = await fetch(`${LMSTUDIO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, stream: true }),
    });
  } catch (cause) {
    throw lmStudioUnreachable(cause);
  }
  if (!res.ok) throw new Error(`LM Studio stream error ${res.status} ${res.statusText}`);

  // SSE, not Ollama's NDJSON: "data: {...}" records terminated by "data: [DONE]".
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  if (!reader) return full;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";           // keep the trailing partial line
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta, full);
        }
      } catch { /* partial JSON — the next chunk completes it */ }
    }
  }
  return full;
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
 * VITE_LLM_PROVIDER=lmstudio (or =ollama) for local development.
 */
export async function invokeLLM(opts) {
  if (provider === "lmstudio") return callLMStudio(opts);
  if (provider === "ollama") return callOllama(opts);
  return callProxy(opts);
}

/**
 * Streaming entry. Local providers stream for real; the cloud proxy returns the
 * full response, so onChunk is called once.
 */
export async function invokeLLMStream(opts, onChunk) {
  if (provider === "lmstudio") return callLMStudioStream(opts, onChunk);
  if (provider === "ollama") return callOllamaStream(opts, onChunk);
  const text = await callProxy(opts);
  onChunk(text, text);
  return text;
}

/**
 * Pull a JSON value out of a reply that may be wrapped in fences or prose.
 * Local models frequently prepend "Here is the JSON:" or append a closing
 * remark, which a bare JSON.parse rejects outright — and the resulting
 * "Unexpected token h" tells the caller nothing about what came back.
 */
function parseLooseJson(raw) {
  const cleaned = String(raw ?? "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch { /* fall through to extraction */ }

  // Widest {...} or [...] span — objects and arrays nest, so anchor on the
  // first opener and the last matching closer rather than a lazy match.
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch { /* try the other bracket type */ }
    }
  }

  throw new Error(
    `The model did not return valid JSON. First 200 chars of the reply: ${cleaned.slice(0, 200)}`,
  );
}

/**
 * Like invokeLLM but parses JSON — tolerates markdown fences and stray prose.
 */
export async function invokeLLMJson(opts) {
  const raw = await invokeLLM({ ...opts, response_format: "json" });
  return parseLooseJson(raw);
}
