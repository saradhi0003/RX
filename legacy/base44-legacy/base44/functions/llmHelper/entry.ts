/**
 * Centralized LLM helper for all backend functions.
 * Supports OpenAI and Anthropic (Claude) with automatic fallback.
 * Provider is controlled by LLM_PROVIDER env var ("openai" | "claude").
 * Falls back to the other provider if the primary one fails.
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI({ model = "gpt-4o", systemPrompt = "", userPrompt = "", schema = null, temperature = 0.7, maxTokens = 2000 }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  if (schema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: { name: "response", strict: false, schema },
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  if (schema) {
    try { return JSON.parse(content); } catch { return content; }
  }
  return content;
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────────────

async function callClaude({ model = "claude-sonnet-4-6", systemPrompt = "", userPrompt = "", temperature = 0.7, maxTokens = 2000 }) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic error ${res.status}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error("Empty Anthropic response");
  return content;
}

// ─── Unified LLM call ─────────────────────────────────────────────────────────

/**
 * Call the primary LLM provider with automatic fallback.
 *
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {object|null} params.schema      - JSON schema for structured output (OpenAI only)
 * @param {boolean} params.parseJson       - Auto-parse JSON from Claude responses
 * @param {string} params.openaiModel
 * @param {string} params.claudeModel
 * @param {number} params.temperature
 * @param {number} params.maxTokens
 * @returns {Promise<string|object>}
 */
export async function callLLM({
  systemPrompt = "",
  userPrompt = "",
  schema = null,
  parseJson = false,
  openaiModel = "gpt-4o",
  claudeModel = "claude-sonnet-4-6",
  temperature = 0.7,
  maxTokens = 2000,
}) {
  const useOpenAI = LLM_PROVIDER === "openai";
  const primaryLabel = useOpenAI ? "OpenAI" : "Claude";
  const fallbackLabel = useOpenAI ? "Claude" : "OpenAI";

  const tryOpenAI = () => callOpenAI({ model: openaiModel, systemPrompt, userPrompt, schema, temperature, maxTokens });
  const tryClaude = async () => {
    const raw = await callClaude({ model: claudeModel, systemPrompt, userPrompt, temperature, maxTokens });
    if (parseJson || schema) {
      try {
        // Claude may wrap JSON in markdown fences
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
      } catch {
        return raw;
      }
    }
    return raw;
  };

  // Primary attempt
  try {
    const result = useOpenAI ? await tryOpenAI() : await tryClaude();
    return result;
  } catch (primaryErr) {
    console.warn(`${primaryLabel} failed, trying ${fallbackLabel}:`, primaryErr.message);
  }

  // Fallback attempt
  try {
    const result = useOpenAI ? await tryClaude() : await tryOpenAI();
    return result;
  } catch (fallbackErr) {
    throw new Error(`Both LLM providers failed. Last error: ${fallbackErr.message}`);
  }
}

/**
 * Convenience: call LLM and always return parsed JSON.
 */
export async function callLLMJson(params) {
  return callLLM({ ...params, parseJson: true });
}