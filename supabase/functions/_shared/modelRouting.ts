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

// ── Fallback chain ──────────────────────────────────────────────────────────
// Cost-ordered: DeepSeek cheapest → Alibaba cheapest → Anthropic cheapest.
// The local fleet is never a *fallback* — it is only ever the explicit primary
// (a `local/` id). If local inference is wanted it must be asked for; silently
// rerouting a paid request to a laptop behind a tunnel would trade a working
// paid call for an maybe-down free one.
export const FALLBACK_MODELS = [
  "deepseek-chat",
  "qwen-turbo",
  "claude-3-5-haiku-20241022",
] as const;

/** Which API keys the runtime actually has — gates fallback candidates. */
export interface ProviderAvailability {
  deepseek: boolean;
  dashscope: boolean;
  anthropic: boolean;
}

/**
 * Whether `model`'s provider has credentials. Models without a key check here
 * (OpenAI family, the local fleet) are assumed configured — their own call
 * path produces the precise error if not.
 */
export function providerConfigured(model: string, avail: ProviderAvailability): boolean {
  const lower = String(model || "").toLowerCase();
  if (lower.startsWith("deepseek")) return avail.deepseek;
  if (lower.startsWith("qwen") || lower.startsWith("alibaba")) return avail.dashscope;
  if (lower.startsWith("claude")) return avail.anthropic;
  return true;
}

/**
 * Ordered list of models to try after `primaryModel` fails. Skips the primary
 * itself and any candidate whose provider has no credentials — trying those
 * would just burn the timeout budget on a guaranteed "key not configured".
 *
 * `allowPaidFallback` is the spend policy, and it defaults to FALSE for a
 * `local/` primary. Asking for `local/…` is an explicit instruction to run for
 * free; quietly answering it with a billable provider is the one thing that
 * instruction rules out. This is not hypothetical — a dead tunnel did exactly
 * that here, and the only trace was a `deepseek-chat` row in llm_usage where a
 * `local/…` row belonged. Failing loudly is recoverable (the tunnel supervisor
 * restarts it, and the error says why); silently spending is not, because
 * nobody looks until the bill arrives.
 *
 * A cloud primary still falls back normally — it was always going to cost
 * something, so the chain is strictly protective there.
 */
export function fallbackCandidates(
  primaryModel: string,
  avail: ProviderAvailability,
  opts: { allowPaidFallback?: boolean; chain?: readonly string[] } = {},
): string[] {
  const primary = String(primaryModel || "").toLowerCase();
  const allowPaid = opts.allowPaidFallback === true;

  // An explicitly configured chain (ai_recruiter_settings.fallback_models, set
  // in the Settings UI) wins over the built-in order — that is the whole point
  // of making it configurable: what runs is what the operator listed, in their
  // order, not what the code decided.
  const source = (opts.chain && opts.chain.length > 0)
    ? opts.chain.map((m) => String(m || "").trim()).filter(Boolean)
    : (opts.chain ? [] : FALLBACK_MODELS.slice());

  return source.filter((m) => {
    if (m.toLowerCase() === primary) return false;              // already tried
    if (!providerConfigured(m, avail)) return false;            // no credentials
    // Spend policy: with a free local primary, a billable fallback is only
    // reachable via an explicit opt-in. Local→local fallback is always fine.
    if (isLocalModel(primary) && !isLocalModel(m) && !allowPaid) return false;
    return true;
  });
}
