// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
// ============================================================================
// livekitToken — PASTE-VERSION for Supabase Dashboard
//
// This is a self-contained copy of the Edge Function with no local imports,
// so you can paste it directly into the Supabase Dashboard's Edge Function
// editor (no CLI / login required).
//
// Steps:
//   1. https://supabase.com/dashboard/project/bwjfglerixssibenkjse/functions
//   2. Click "Deploy a new function" (or "+ New function")
//   3. Name it exactly:  livekitToken
//   4. Paste the entire contents of this file
//   5. Toggle off "Verify JWT" (we want the browser to call this without a Supabase session)
//   6. Click Deploy
//
// Before deploy, also set the three secrets at:
//   https://supabase.com/dashboard/project/bwjfglerixssibenkjse/settings/functions
//      LIVEKIT_URL          = wss://talentstack-cv606gc8.livekit.cloud
//      LIVEKIT_API_KEY      = APIxxxxxxxx
//      LIVEKIT_API_SECRET   = secretxxxxxxxxxxxx
// ============================================================================

import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    if (!body?.room || !body?.identity) {
      return json({ error: "Missing 'room' or 'identity'" }, 400);
    }

    const apiKey    = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url       = Deno.env.get("LIVEKIT_URL") ?? "";

    if (!apiKey || !apiSecret) {
      return json({
        error: "Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET. Set them in " +
               "Project Settings → Edge Functions → Secrets.",
      }, 500);
    }

    const ttl = Math.min(Math.max(body.ttl_seconds ?? 14400, 60), 86400);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: body.identity,
      name: body.name || body.identity,
      ttl,
    });
    at.addGrant({
      room: body.room,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return json({ token, url, room: body.room, identity: body.identity });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
