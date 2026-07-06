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
    LIVEKIT_URL: Boolean(get("LIVEKIT_URL")),
    LIVEKIT_API_KEY: Boolean(get("LIVEKIT_API_KEY")),
    LIVEKIT_API_SECRET: Boolean(get("LIVEKIT_API_SECRET")),
    POSTMARK_SERVER_TOKEN: hasPostmark(),
    RESEND_API_KEY: hasResend(),
    CRON_SECRET: hasCronSecret(),
  };
}
