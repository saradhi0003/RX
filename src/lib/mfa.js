/**
 * TOTP MFA helpers — thin wrappers over supabase.auth.mfa.*.
 *
 * Flow:
 *   enroll   → enrollTotp() returns { factorId, qrSvg, secret, uri }
 *   confirm  → verifyEnrollment(factorId, code) activates the factor
 *   login    → challengeAndVerify(factorId, code) elevates the session to aal2
 *   manage   → listFactors() / unenroll(factorId)
 *
 * AAL (Authenticator Assurance Level):
 *   aal1 = password only; aal2 = password + a verified 2nd factor.
 *   mfaStatus() tells the app whether the current session must step up.
 */
import { supabase } from "@/lib/supabase";

/** All TOTP factors on the account (verified + unverified). */
export async function listFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return {
    all: data?.all ?? [],
    totp: data?.totp ?? [],
    verified: (data?.all ?? []).filter((f) => f.status === "verified"),
  };
}

/**
 * Begin TOTP enrollment. Returns a QR (SVG string) + secret to show the user.
 * The factor is created in an `unverified` state until verifyEnrollment().
 */
export async function enrollTotp(friendlyName = "Authenticator") {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrSvg: data.totp?.qr_code,   // inline SVG string
    secret: data.totp?.secret,   // manual-entry key
    uri: data.totp?.uri,         // otpauth:// URI
  };
}

/** Confirm a freshly enrolled factor with the first 6-digit code. */
export async function verifyEnrollment(factorId, code) {
  const { data: challenge, error: cErr } =
    await supabase.auth.mfa.challenge({ factorId });
  if (cErr) throw cErr;
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (vErr) throw vErr;
  return true;
}

/** At login: prove possession of the factor to raise the session to aal2. */
export async function challengeAndVerify(factorId, code) {
  return verifyEnrollment(factorId, code); // same challenge→verify sequence
}

/** Remove a factor (e.g. lost device — requires an aal2 session). */
export async function unenroll(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  return true;
}

/**
 * The single source of truth for "does this session need to step up?".
 * Returns { currentLevel, nextLevel, shouldChallenge, isEnrolled }.
 *  - shouldChallenge: user has a verified factor but session is still aal1.
 */
export async function mfaStatus() {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  const currentLevel = data?.currentLevel ?? null;
  const nextLevel = data?.nextLevel ?? null;
  return {
    currentLevel,
    nextLevel,
    isEnrolled: nextLevel === "aal2",
    shouldChallenge: currentLevel === "aal1" && nextLevel === "aal2",
  };
}
