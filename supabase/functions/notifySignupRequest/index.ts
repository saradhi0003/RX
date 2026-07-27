// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or URL imports.
/**
 * notifySignupRequest
 * POST {}  (Authorization: Bearer <caller's JWT>)
 *
 * Tells the admins that a new user is sitting at status='invited' waiting for
 * approval. Called by the client right after AuthContext bootstraps an invited
 * profile, so the request doesn't sit unnoticed behind the 020 approval gate.
 *
 * ⚠ This is the ONE user-invoked function that must NOT use
 * requireApprovedUser(): the whole point is that the caller is *not* approved.
 * It verifies the JWT (so the request is a real signed-in user and the caller
 * can only ever notify about themselves) but stops short of the approval check.
 *
 * Best-effort by contract:
 *   - unconfigured SMTP  -> 200 { skipped: true }, nothing stamped
 *   - send failure       -> 200 { sent: false },   nothing stamped
 *   - success            -> 200 { sent: true },    notified_at stamped
 * notified_at is only written on success, so a failed attempt retries on the
 * user's next sign-in. Approval never depends on this email — Access Control
 * always shows pending requests.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { getCallerUser } from "../_shared/auth.ts";
import { sendMail, hasSmtp } from "../_shared/email.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://rx-self.vercel.app";

Deno.serve(withErrorHandling(async (req: Request) => {
  if (req.method !== "POST") return errResponse("Method not allowed", 405);

  // Authenticate but deliberately do not require approval.
  const { user, error } = await getCallerUser(req);
  if (!user) return errResponse(error, 401);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, status, notified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return errResponse("No profile for this user", 404);

  // Only pending users generate a request, and only once.
  if (profile.status !== "invited") return okResponse({ sent: false, reason: "not_pending" });
  if (profile.notified_at)          return okResponse({ sent: false, reason: "already_notified" });

  if (!hasSmtp()) {
    // Not an error: the request is still visible in Access Control.
    return okResponse({ sent: false, skipped: true, reason: "smtp_not_configured" });
  }

  const { data: admins } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("role", "admin")
    .eq("status", "active");

  const recipients = (admins || []).map((a) => a.email).filter(Boolean);
  if (!recipients.length) return okResponse({ sent: false, reason: "no_admin_recipients" });

  const who = profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
  const result = await sendMail({
    to: recipients,
    subject: `Access request: ${profile.email}`,
    body: [
      `${who} signed up for Recruiter X and is waiting for approval.`,
      ``,
      `They currently have no access to any data — the approval gate blocks`,
      `every table until an admin activates them.`,
      ``,
      `Approve or decline: ${APP_URL}/AccessControl`,
      ``,
      `— Recruiter X`,
    ].join("\n"),
  });

  if (!result.ok) {
    // Leave notified_at NULL so the next sign-in retries.
    return okResponse({ sent: false, skipped: result.skipped, error: result.error });
  }

  await supabase
    .from("user_profiles")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", user.id);

  return okResponse({ sent: true, recipients: recipients.length });
}));
