/**
 * LLM pricing table + cost estimator.
 *
 * Prices are per 1M tokens (input / output). Unknown models fall back to a
 * non-zero default so the daily cost ceiling cannot be silently disabled.
 *
 * Source: official provider pricing as of 2026-08. Update as rates change.
 */

export interface ModelPrice {
  input: number;
  output: number;
  provider: string;
}

// Prices in USD per 1M tokens.
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0, provider: "openai" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, provider: "openai" },
  "o1-preview": { input: 15.0, output: 60.0, provider: "openai" },
  "o1-mini": { input: 3.0, output: 12.0, provider: "openai" },
  "o3-mini": { input: 1.1, output: 4.4, provider: "openai" },

  // Anthropic
  "claude-opus-4-8": { input: 15.0, output: 75.0, provider: "anthropic" },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, provider: "anthropic" },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25, provider: "anthropic" },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0, provider: "anthropic" },

  // DeepSeek
  "deepseek-chat": { input: 0.27, output: 1.1, provider: "deepseek" },
  "deepseek-reasoner": { input: 0.55, output: 2.19, provider: "deepseek" },
  "deepseek-coder": { input: 0.27, output: 1.1, provider: "deepseek" },

  // Alibaba / DashScope (Qwen)
  "qwen-max": { input: 0.5, output: 1.5, provider: "dashscope" },
  "qwen-plus": { input: 0.2, output: 0.6, provider: "dashscope" },
  "qwen-turbo": { input: 0.06, output: 0.18, provider: "dashscope" },
  "qwen2.5-14b-instruct": { input: 0.0, output: 0.0, provider: "dashscope" },
  "qwen2.5-4b-instruct": { input: 0.0, output: 0.0, provider: "dashscope" },

  // Local / zero-cost
  "llama3.2": { input: 0.0, output: 0.0, provider: "ollama" },
  "lmstudio": { input: 0.0, output: 0.0, provider: "lmstudio" },
  "openai-compatible": { input: 0.0, output: 0.0, provider: "openai-compatible" },
  // Anything reached through the LM Studio tunnel is logged under its
  // `local/` id (see _shared/llm.ts). Without this entry a local "qwen3-14b"
  // falls through to DEFAULT_PRICE and bills $0.50/$1.50 per 1M tokens against
  // the daily ceiling — free inference would slowly lock out the paid
  // providers. Prefix match, so it covers every model behind the tunnel.
  "local/": { input: 0.0, output: 0.0, provider: "lmstudio-tunnel" },
};

const DEFAULT_PRICE: ModelPrice = { input: 0.5, output: 1.5, provider: "unknown" };

/** Longest-prefix match so dated snapshots still resolve. */
export function getPrice(model = ""): ModelPrice {
  const key = String(model).toLowerCase();
  let best = "";
  for (const id of Object.keys(MODEL_PRICES)) {
    if (key.startsWith(id.toLowerCase()) && id.length > best.length) {
      best = id;
    }
  }
  return best ? MODEL_PRICES[best] : DEFAULT_PRICE;
}

/** Estimate cost in USD from token counts. */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = getPrice(model);
  const cost =
    (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
  return Number(cost.toFixed(6));
}
