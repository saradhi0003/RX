// @ts-nocheck   — Deno-runtime module (crypto.subtle, Deno.env).
/**
 * oauthState.ts — HMAC-signed OAuth `state` parameter.
 *
 * The callback endpoint is unauthenticated (verify_jwt = false), so the state
 * is the only thing proving the consent flow was started by one of our admins.
 * Signed with the service-role key — always present, never leaves the server.
 *
 * Format: base64url(JSON payload) "." base64url(HMAC-SHA256(payload)).
 */
import { getSupabaseServiceRoleKey } from "./env.ts";

const encoder = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSupabaseServiceRoleKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return b64url(sig);
}

export interface OAuthStatePayload {
  provider: "gmail" | "zoho";
  uid: string;
  workspaceId: string;
  ts: number;
}

export async function signState(payload: OAuthStatePayload): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

/** Returns the payload when the signature is valid and fresh (<15 min). */
export async function verifyState(state: string): Promise<OAuthStatePayload | null> {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(body.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    )) as OAuthStatePayload;
    if (Date.now() - payload.ts > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
