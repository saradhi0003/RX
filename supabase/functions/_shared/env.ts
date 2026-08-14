// @ts-nocheck
/**
 * Central env module for Edge Functions — the single place that reads
 * Deno.env. Mirrors the StockAnalysis `lib/env.ts` pattern:
 *   hasX()  → boolean presence checks (safe to report to clients)
 *   getX()  → throwing getters with a clear "Missing required env" message
 *
 * Secrets live in Supabase Edge Function secrets (`supabase secrets set`),
 * NEVER in Vercel VITE_* vars (those are baked into the public browser bundle).
 */

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const get = (name: string) => Deno.env.get(name) || "";

/* ── Supabase (injected automatically into every Edge Function) ── */
export const hasSupabase = () =>
  Boolean(get("SUPABASE_URL") && get("SUPABASE_SERVICE_ROLE_KEY"));
export const getSupabaseUrl = () => getRequiredEnv("SUPABASE_URL");
export const getSupabaseServiceRoleKey = () => getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

/* ── LLM providers ── */
export const hasOpenAI = () => Boolean(get("OPENAI_API_KEY"));
export const getOpenAIKey = () => getRequiredEnv("OPENAI_API_KEY");

export const hasAnthropic = () => Boolean(get("ANTHROPIC_API_KEY"));
export const getAnthropicKey = () => getRequiredEnv("ANTHROPIC_API_KEY");

export const hasOllama = () => Boolean(get("OLLAMA_BASE_URL"));
export const getOllamaBaseUrl = () =>
  get("OLLAMA_BASE_URL") || "http://host.docker.internal:11434";

/* ── OpenAI-compatible providers (DeepSeek, Alibaba/DashScope, local Qwen, etc.) ── */
export const hasDeepSeek = () => Boolean(get("DEEPSEEK_API_KEY"));
export const getDeepSeekKey = () => getRequiredEnv("DEEPSEEK_API_KEY");
export const getDeepSeekBaseUrl = () =>
  get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1";

export const hasDashScope = () => Boolean(get("DASHSCOPE_API_KEY"));
export const getDashScopeKey = () => getRequiredEnv("DASHSCOPE_API_KEY");
export const getDashScopeBaseUrl = () =>
  get("DASHSCOPE_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const hasOpenAICompatible = () =>
  Boolean(get("OPENAI_COMPATIBLE_API_KEY") && get("OPENAI_COMPATIBLE_BASE_URL"));
export const getOpenAICompatibleEnv = () => ({
  baseURL: getRequiredEnv("OPENAI_COMPATIBLE_BASE_URL"),
  apiKey: getRequiredEnv("OPENAI_COMPATIBLE_API_KEY"),
  defaultModel: get("OPENAI_COMPATIBLE_DEFAULT_MODEL") || "",
});

/**
 * Soft reads of the same two vars, for the `local/…` fleet path in llm.ts.
 * That path has to tell "no tunnel configured" apart from "tunnel configured
 * but no secret" — the throwing getters above collapse both into one message,
 * and the second case is the one that looks like an outage when it is really a
 * missing `supabase secrets set`.
 *
 * These point at the LM Studio gateway published by
 * `./scripts/tunnel-lmstudio.sh`; the "API key" is that gateway's shared
 * secret, not a provider credential.
 */
export const readOpenAICompatibleBaseUrl = () => get("OPENAI_COMPATIBLE_BASE_URL");
export const readOpenAICompatibleApiKey = () => get("OPENAI_COMPATIBLE_API_KEY");
export const getOpenAICompatibleDefaultModel = () => get("OPENAI_COMPATIBLE_DEFAULT_MODEL");

/* ── LiveKit (video calls) ── */
export const hasLiveKit = () =>
  Boolean(get("LIVEKIT_URL") && get("LIVEKIT_API_KEY") && get("LIVEKIT_API_SECRET"));
export const getLiveKitEnv = () => ({
  url: getRequiredEnv("LIVEKIT_URL"),
  apiKey: getRequiredEnv("LIVEKIT_API_KEY"),
  apiSecret: getRequiredEnv("LIVEKIT_API_SECRET"),
});

/* ── Email providers (either one enables sending) ── */
export const hasPostmark = () => Boolean(get("POSTMARK_SERVER_TOKEN"));
export const hasResend = () => Boolean(get("RESEND_API_KEY"));
export const hasEmailProvider = () => hasPostmark() || hasResend();
export const getPostmarkToken = () => getRequiredEnv("POSTMARK_SERVER_TOKEN");
export const getResendKey = () => getRequiredEnv("RESEND_API_KEY");

/* ── Cron / webhook gating ── */
export const hasCronSecret = () => Boolean(get("CRON_SECRET"));
export const getCronSecret = () => getRequiredEnv("CRON_SECRET");

/* ── Email intake OAuth (Gmail / Zoho inbound polling) ── */
export const hasGoogleOAuth = () =>
  Boolean(get("GOOGLE_OAUTH_CLIENT_ID") && get("GOOGLE_OAUTH_CLIENT_SECRET"));
export const getGoogleOAuthEnv = () => ({
  clientId: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
  clientSecret: getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
});
export const hasZohoOAuth = () =>
  Boolean(get("ZOHO_OAUTH_CLIENT_ID") && get("ZOHO_OAUTH_CLIENT_SECRET"));
export const getZohoOAuthEnv = () => ({
  clientId: getRequiredEnv("ZOHO_OAUTH_CLIENT_ID"),
  clientSecret: getRequiredEnv("ZOHO_OAUTH_CLIENT_SECRET"),
});
/** Where the provider sends the user back after consent (an Edge Function). */
export const getEmailOAuthRedirectUrl = () =>
  get("EMAIL_OAUTH_REDIRECT_URL") || `${get("SUPABASE_URL")}/functions/v1/emailOAuthCallback`;
/** Where the callback lands the browser afterwards (the app's settings page). */
export const getAppUrl = () => get("APP_URL") || "https://rx-self.vercel.app";

/**
 * Presence map for every expected secret — names and booleans ONLY, never
 * values. Safe to include in healthCheck responses.
 */
export function envPresence(): Record<string, boolean> {
  return {
    SUPABASE_URL: Boolean(get("SUPABASE_URL")),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(get("SUPABASE_SERVICE_ROLE_KEY")),
    OPENAI_API_KEY: hasOpenAI(),
    ANTHROPIC_API_KEY: hasAnthropic(),
    OLLAMA_BASE_URL: hasOllama(),
    DEEPSEEK_API_KEY: hasDeepSeek(),
    DEEPSEEK_BASE_URL: Boolean(get("DEEPSEEK_BASE_URL")),
    DASHSCOPE_API_KEY: hasDashScope(),
    DASHSCOPE_BASE_URL: Boolean(get("DASHSCOPE_BASE_URL")),
    OPENAI_COMPATIBLE_API_KEY: Boolean(get("OPENAI_COMPATIBLE_API_KEY")),
    OPENAI_COMPATIBLE_BASE_URL: Boolean(get("OPENAI_COMPATIBLE_BASE_URL")),
    LIVEKIT_URL: Boolean(get("LIVEKIT_URL")),
    LIVEKIT_API_KEY: Boolean(get("LIVEKIT_API_KEY")),
    LIVEKIT_API_SECRET: Boolean(get("LIVEKIT_API_SECRET")),
    POSTMARK_SERVER_TOKEN: hasPostmark(),
    RESEND_API_KEY: hasResend(),
    CRON_SECRET: hasCronSecret(),
    GOOGLE_OAUTH_CLIENT_ID: Boolean(get("GOOGLE_OAUTH_CLIENT_ID")),
    ZOHO_OAUTH_CLIENT_ID: Boolean(get("ZOHO_OAUTH_CLIENT_ID")),
  };
}
