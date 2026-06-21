// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
/**
 * livekitToken — mints a short-lived JWT access token for a LiveKit room.
 *
 * Keeps LIVEKIT_API_SECRET out of the browser.
 *
 * Deploy:
 *   supabase functions deploy livekitToken
 *   supabase secrets set LIVEKIT_API_KEY=APIxxxx
 *   supabase secrets set LIVEKIT_API_SECRET=secretxxxx
 *   supabase secrets set LIVEKIT_URL=wss://<project>.livekit.cloud
 *
 * Request:  POST { room, identity, name?, ttl_seconds? }
 * Response: { token, url, room, identity }
 */
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.9.7";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

interface TokenReq {
  room: string;
  identity: string;
  name?: string;
  ttl_seconds?: number;
}

Deno.serve(withErrorHandling(async (req: Request) => {
  if (req.method !== "POST") return errResponse("Method not allowed", 405);

  const body = (await req.json().catch(() => null)) as TokenReq | null;
  if (!body?.room || !body?.identity) {
    return errResponse("Missing 'room' or 'identity' in body", 400);
  }

  const apiKey    = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const url       = Deno.env.get("LIVEKIT_URL") ?? "";

  if (!apiKey || !apiSecret) {
    return errResponse(
      "Server missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET. " +
      "Run: supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...",
      500
    );
  }

  const ttl = Math.min(Math.max(body.ttl_seconds ?? 60 * 60 * 4, 60), 60 * 60 * 24);

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

  return okResponse({
    token,
    url,
    room: body.room,
    identity: body.identity,
  });
}));
