/**
 * CORS helper for Supabase Edge Functions.
 *
 * Reads ALLOWED_ORIGINS as a comma-separated list of origins from Edge Function
 * secrets (or env). Falls back to the production RX app + localhost so dev
 * keeps working without extra config.
 *
 * Usage:
 *   import { corsHeadersFor, handleCors } from "../_shared/cors.ts";
 *   const origin = req.headers.get("origin");
 *   if (req.method === "OPTIONS") return handleCors(origin);
 *   const headers = { ...corsHeadersFor(origin), "Content-Type": "application/json" };
 */

// `rx-self.vercel.app` is the domain `main` actually auto-deploys to (see
// CLAUDE.md) and was missing here, so with ALLOWED_ORIGINS unset every browser
// call from production died at the CORS preflight — no Access-Control-Allow-
// Origin header, so the request never reached the function at all. That took
// down every browser-initiated Edge Function feature at once (AI Insights, the
// assistant, resume parsing), which reads as "the AI is broken" rather than as
// a config problem. The custom domains stay listed for when they cut over.
const DEFAULT_ORIGINS = [
  "https://rx-self.vercel.app",
  "https://app.talentstack.org",
  "https://recruiterx.app",
  "https://www.recruiterx.app",
  "http://localhost:5173",
  "http://localhost:5175",
];

function allowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  if (!env) return DEFAULT_ORIGINS;
  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function handleCors(origin: string | null): Response {
  return new Response("ok", { headers: corsHeadersFor(origin) });
}

export function corsError(origin: string | null, message: string, status = 403): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
  });
}
