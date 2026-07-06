/**
 * Client-side env module — the browser half of the env pattern.
 *
 * Only PUBLIC values belong here: every VITE_* var is baked into the shipped
 * JS bundle at build time and readable by anyone. Secrets (OpenAI, Anthropic,
 * LiveKit API keys, email tokens) live in Supabase Edge Function secrets and
 * are checked server-side by the healthCheck function.
 *
 * Vercel setup: Project → Settings → Environments → add the vars below,
 * then redeploy (Vite inlines them at build time — no hot apply).
 */

// IMPORTANT: access each var STATICALLY (import.meta.env.VITE_X). Dynamic
// access (import.meta.env[name]) forces Vite to inline the ENTIRE env object
// into the bundle — including any accidentally VITE_-prefixed secret from a
// dev machine's .env.local. Static member access is define-replaced per var.
const VALUES = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? "",
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  VITE_LIVEKIT_URL: import.meta.env.VITE_LIVEKIT_URL ?? "",
  VITE_APP_URL: import.meta.env.VITE_APP_URL ?? "",
  VITE_LLM_PROVIDER: import.meta.env.VITE_LLM_PROVIDER ?? "",
};

// Required for the app to function at all.
const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

// Optional — features degrade gracefully without them.
const OPTIONAL = ["VITE_LIVEKIT_URL", "VITE_APP_URL", "VITE_LLM_PROVIDER"];

const read = (name) => VALUES[name] ?? "";

const isPlaceholder = (v) =>
  !v || v.includes("your-project-id") || v.includes("your-anon-key");

/** Names of required VITE_* vars that are missing or placeholders. */
export function missingClientEnv() {
  return REQUIRED.filter((name) => isPlaceholder(read(name)));
}

/** Presence map of all expected client vars — booleans only. */
export function clientEnvPresence() {
  const out = {};
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    out[name] = !isPlaceholder(read(name));
  }
  return out;
}

/** True when every required client var is set (mirrors isSupabaseConfigured). */
export function isClientEnvConfigured() {
  return missingClientEnv().length === 0;
}
