/**
 * Which provider serves a given model id.
 *
 * Split out of llm.ts deliberately: that module imports the OpenAI and
 * Anthropic SDKs through Deno `npm:` specifiers, which Vitest cannot resolve,
 * so anything living there is effectively untestable from `npm test`. This
 * decision is the one most worth testing — getting it wrong sends a prompt to
 * the wrong company — so it lives where a test can reach it, with no imports.
 */

export type Provider = "openai" | "anthropic" | "ollama" | "openai-compatible";

/**
 * `local/` (or `lmstudio/`) means "the LM Studio fleet behind the cloudflared
 * tunnel", with the remainder being the literal model id to send upstream.
 *
 * An explicit prefix is required because a family name says what a model *is*,
 * never where it is served from — and the two heuristics below read family
 * names. A locally-served `qwen2.5-coder-14b` matches `startsWith("qwen")` and
 * would be shipped to Alibaba's cloud: prompt contents (candidate PII, in this
 * app) egress to a third party, and it bills. Stating the location is the only
 * way to distinguish them.
 */
export const LOCAL_MODEL_PREFIX = /^(?:local|lmstudio)\//i;

export const isLocalModel = (model: string): boolean =>
  LOCAL_MODEL_PREFIX.test(String(model || ""));

/** `local/qwen2.5-coder-14b` → `qwen2.5-coder-14b`. Others pass through. */
export const stripLocalPrefix = (model: string): string =>
  String(model || "").replace(LOCAL_MODEL_PREFIX, "");

export function detectProvider(model: string): Provider {
  const lower = String(model || "").toLowerCase();
  // First: an explicit routing instruction must beat every heuristic below it.
  if (isLocalModel(lower)) return "openai-compatible";
  if (lower.startsWith("claude")) return "anthropic";
  if (
    lower.startsWith("llama") || lower.startsWith("mistral") || lower.startsWith("phi")
  ) return "ollama";
  if (
    lower.startsWith("deepseek") || lower.startsWith("qwen") || lower.startsWith("grok") ||
    lower.startsWith("alibaba") || lower.includes("-compatible")
  ) return "openai-compatible";
  return "openai";
}
