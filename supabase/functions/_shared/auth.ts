// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or npm: imports.
/**
 * auth.ts — the server-side twin of the approval gate.
 *
 * WHY THIS EXISTS
 * Every function here uses the service-role client from supabaseClient.ts, and
 * the service role **bypasses RLS**. So migration 020's `auth_is_approved()`
 * predicate — which stops an unapproved user reading data through PostgREST —
 * does nothing for Edge Functions. Without an explicit re-check, a user sitting
 * at status='invited' (or a locked one) still holds a valid JWT and can invoke
 * llmProxy, sendApprovedDraft, transcribeRecording, etc. and have the server
 * act on their behalf with full privileges.
 *
 * `verify_jwt` is NOT a substitute: it proves the caller is authenticated, not
 * that they are approved. The two gates answer different questions.
 *
 * This module verifies the JWT itself rather than trusting the platform flag,
 * so it also works on functions deployed with verify_jwt = false.
 *
 * USAGE
 *   const gate = await requireApprovedUser(req);
 *   if (gate.response) return gate.response;      // 401 / 403 already formed
 *   // ...gate.user.id and gate.profile are verified from here on
 *
 * Fails CLOSED: any error resolving the caller or their profile denies access.
 */
import { supabase } from "./supabaseClient.ts";
import { errResponse } from "./errorHandler.ts";
import { getSupabaseServiceRoleKey } from "./env.ts";

/** Pull the bearer token off the request, ignoring an empty/garbage header. */
function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Trusted internal caller: another Edge Function fanning out with the service
 * key (channelMessageWebhook → aiRecruiterParseJob / parseResumeFile, and
 * reprocessChannelMessage → channelMessageWebhook). There is no end user in
 * that chain — an inbound Telegram/Slack/WhatsApp message has no session — so
 * approval is not a meaningful question and gating it would break ingestion.
 *
 * Safe because the service key never leaves the server: it lives in Edge
 * Function secrets and is never exposed under a VITE_ prefix. Anyone presenting
 * it already has full database access by definition.
 */
function isServiceRoleCaller(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  try {
    return token === getSupabaseServiceRoleKey();
  } catch {
    return false;   // key not configured — treat as untrusted
  }
}

/** The synthetic principal returned for trusted service-to-service calls. */
const SERVICE_PRINCIPAL = Object.freeze({
  user: Object.freeze({ id: null, email: "service-role@internal" }),
  profile: Object.freeze({
    id: null,
    email: "service-role@internal",
    full_name: "Internal service",
    role: "admin",
    status: "active",
    is_locked: false,
  }),
});

/**
 * Resolve the caller's JWT to a real user.
 * Passing the token to getUser() validates it against the auth server — an
 * expired, forged, or anon-key-as-token request resolves to null.
 */
export async function getCallerUser(req: Request) {
  const token = bearerToken(req);
  if (!token) return { user: null, error: "Missing Authorization header" };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: "Invalid or expired session" };

  return { user: data.user, error: null };
}

/**
 * Verify the caller AND that their profile is approved + unlocked.
 * Mirrors `auth_is_approved()` (migration 020) and Layout.jsx `isBlocked`.
 *
 * @returns `{ user, profile, response }` — when `response` is non-null it is a
 *          finished 401/403 the caller should return immediately.
 */
export async function requireApprovedUser(req: Request) {
  // Internal fan-out between Edge Functions — no end user to approve.
  if (isServiceRoleCaller(req)) {
    return { ...SERVICE_PRINCIPAL, response: null, isService: true };
  }

  const { user, error } = await getCallerUser(req);
  if (!user) return { user: null, profile: null, response: errResponse(error, 401) };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, status, is_locked")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    // Fail closed — we cannot prove approval, so we do not grant it.
    return {
      user, profile: null,
      response: errResponse(`Could not verify account status: ${profileError.message}`, 403),
    };
  }

  // No profile row yet = signed up but never bootstrapped → pending, not approved.
  if (!profile) {
    return {
      user, profile: null,
      response: errResponse("Your account is pending administrator approval.", 403),
    };
  }

  if (profile.is_locked === true) {
    return {
      user, profile,
      response: errResponse("Your account has been locked. Contact an administrator.", 403),
    };
  }

  if (profile.status !== "active") {
    return {
      user, profile,
      response: errResponse("Your account is pending administrator approval.", 403),
    };
  }

  return { user, profile, response: null };
}

/**
 * Approved AND an admin. The twin of `auth_is_admin()` as hardened by 020
 * (a locked or inactive admin is not an admin).
 */
export async function requireAdminUser(req: Request) {
  const gate = await requireApprovedUser(req);
  if (gate.response) return gate;

  if (gate.profile.role !== "admin") {
    return { ...gate, response: errResponse("Administrator access required.", 403) };
  }

  return gate;
}
