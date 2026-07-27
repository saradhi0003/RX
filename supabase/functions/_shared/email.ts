// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or URL imports.
/**
 * email.ts — best-effort transactional email over SMTP.
 *
 * Used for operational notices the app sends about itself (e.g. "someone
 * requested access"), NOT for recruiter outreach — that path goes through
 * sendApprovedDraft, which has its own provider, logging and send-lock.
 *
 * DESIGN: best-effort by contract. If SMTP is not configured, send() returns
 * `{ ok: false, skipped: true }` instead of throwing. Callers must treat email
 * as an optional nicety — an admin notification failing must never block a
 * signup, and the Access Control screen is always the source of truth for
 * pending requests.
 *
 * Config (Supabase Edge Function secrets — `supabase secrets set`):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER
 */
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const env = (k: string) => Deno.env.get(k) || "";

/** True when every SMTP setting needed to send is present. */
export function hasSmtp(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS") && env("SMTP_SENDER"));
}

/**
 * Send one plain-text email. Never throws.
 * @returns { ok, skipped?, error? }
 */
export async function sendMail(
  { to, subject, body }: { to: string | string[]; subject: string; body: string },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!hasSmtp()) {
    console.warn("[email] SMTP not configured — skipping send. Set SMTP_* secrets to enable.");
    return { ok: false, skipped: true };
  }

  const port = Number(env("SMTP_PORT") || 465);
  const client = new SMTPClient({
    connection: {
      hostname: env("SMTP_HOST"),
      port,
      tls: port === 465,           // 465 = implicit TLS; 587 = STARTTLS
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") },
    },
  });

  try {
    await client.send({
      from: env("SMTP_SENDER"),
      to: Array.isArray(to) ? to : [to],
      subject,
      content: body,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] send failed: ${msg}`);
    return { ok: false, error: msg };
  } finally {
    try { await client.close(); } catch { /* already closed */ }
  }
}
