/**
 * pricing.ts — model price table + cost estimation.
 *
 * WHY THIS EXISTS
 * `checkDailyCeiling()` sums `llm_usage.cost_usd`, but until now nothing
 * server-side ever wrote a row, and the only client writer hardcoded
 * `cost_usd: 0`. So the daily ceiling summed to $0 and never tripped — the
 * budget rail described in GAPS.md L9 did not actually exist. This module is
 * what turns a completion into a number, so the rail becomes real.
 *
 * Deliberately PURE — no Deno globals, no imports. Vitest imports it directly
 * (`tests/unit/lib/pricing.test.js`) without a Deno shim.
 *
 * Prices are USD per million tokens, as published by each provider. They drift;
 * when they do, update the table — an out-of-date price makes the ceiling
 * inaccurate, not broken, so this is a maintenance chore rather than an outage.
 */

export interface ModelPrice {
  /** USD per 1,000,000 input (prompt) tokens */
  input_per_mtok: number;
  /** USD per 1,000,000 output (completion) tokens */
  output_per_mtok: number;
}

/**
 * Keyed by model id prefix — matched longest-first, so `gpt-4o-mini` wins over
 * `gpt-4o`. Prefix matching means a dated snapshot id
 * (`claude-sonnet-4-5-20250929`) resolves without a table entry per release.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  "gpt-4o-mini": { input_per_mtok: 0.15, output_per_mtok: 0.6 },
  "gpt-4o": { input_per_mtok: 2.5, output_per_mtok: 10 },
  "gpt-4.1-mini": { input_per_mtok: 0.4, output_per_mtok: 1.6 },
  "gpt-4.1": { input_per_mtok: 2, output_per_mtok: 8 },
  "o1-mini": { input_per_mtok: 1.1, output_per_mtok: 4.4 },
  "o1": { input_per_mtok: 15, output_per_mtok: 60 },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  "claude-haiku-4-5": { input_per_mtok: 1, output_per_mtok: 5 },
  "claude-sonnet-4-5": { input_per_mtok: 3, output_per_mtok: 15 },
  "claude-sonnet-5": { input_per_mtok: 3, output_per_mtok: 15 },
  "claude-opus-4": { input_per_mtok: 15, output_per_mtok: 75 },
  "claude-opus-5": { input_per_mtok: 15, output_per_mtok: 75 },

  // ── Embeddings (output tokens are always 0) ───────────────────────────────
  "text-embedding-3-small": { input_per_mtok: 0.02, output_per_mtok: 0 },
  "text-embedding-3-large": { input_per_mtok: 0.13, output_per_mtok: 0 },

  // ── Local Ollama — no marginal cost ───────────────────────────────────────
  "llama": { input_per_mtok: 0, output_per_mtok: 0 },
  "mistral": { input_per_mtok: 0, output_per_mtok: 0 },
  "phi": { input_per_mtok: 0, output_per_mtok: 0 },
  "nomic-embed-text": { input_per_mtok: 0, output_per_mtok: 0 },
};

/**
 * Fallback for an unrecognised model. Deliberately NOT zero: an unknown model
 * costing $0 would silently disable the ceiling, which is the exact failure
 * this module exists to fix. A mid-range guess keeps the rail engaged and makes
 * the miscount visible on the cost dashboard instead of invisible.
 */
export const DEFAULT_PRICE: ModelPrice = { input_per_mtok: 3, output_per_mtok: 15 };

/** Resolve a model id to its price via longest-prefix match. */
export function priceFor(model: string | null | undefined): ModelPrice {
  if (!model) return DEFAULT_PRICE;
  const id = String(model).toLowerCase();

  let best: ModelPrice | null = null;
  let bestLen = -1;
  for (const [prefix, price] of Object.entries(MODEL_PRICES)) {
    if (id.startsWith(prefix) && prefix.length > bestLen) {
      best = price;
      bestLen = prefix.length;
    }
  }
  return best ?? DEFAULT_PRICE;
}

/** True when the model id is absent from the table (surfaced for observability). */
export function isKnownModel(model: string | null | undefined): boolean {
  if (!model) return false;
  const id = String(model).toLowerCase();
  return Object.keys(MODEL_PRICES).some((prefix) => id.startsWith(prefix));
}

/**
 * Cost in USD for one completion. Negative or non-finite token counts are
 * treated as 0 — a provider returning something odd must not corrupt the
 * running total or, worse, subtract from it and un-trip the ceiling.
 */
export function estimateCost(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  const price = priceFor(model);
  const inTok = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0;
  const outTok = Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0;

  const cost =
    (inTok / 1_000_000) * price.input_per_mtok +
    (outTok / 1_000_000) * price.output_per_mtok;

  // llm_usage.cost_usd is NUMERIC(10,6); round here so the DB never truncates
  // silently and the summed ceiling matches what the dashboard displays.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
