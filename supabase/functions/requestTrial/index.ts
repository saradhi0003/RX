// @ts-nocheck — Deno runtime
/**
 * requestTrial — Public trial/demo request handler.
 *
 * Replaces the client-side Core.SendEmail call in Landing.jsx so that:
 *   - the admin address is not hardcoded in the bundle;
 *   - input is validated server-side;
 *   - a simple rate limit is enforced per email + IP;
 *   - an optional Cloudflare Turnstile challenge can be enabled.
 *
 * Deploy:
 *   supabase functions deploy requestTrial
 *   supabase secrets set EMAIL_FROM=noreply@talentstack.org
 *   supabase secrets set ADMIN_TRIAL_EMAIL=admin@talentstack.org
 *   # optional, but recommended:
 *   supabase secrets set TURNSTILE_SECRET=0x...
 *
 * Auth:
 *   verify_jwt = false (public endpoint)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = Deno.env.get("ADMIN_TRIAL_EMAIL") ?? "admin@talentstack.org";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "noreply@talentstack.org";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";
const POSTMARK_TOKEN = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";

const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;
const rateLimit = new Map<string, number[]>();

function json(body: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
  });
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(key) ?? [];
  const windowed = timestamps.filter((t) => now - t < RATE_LIMIT_MS);
  rateLimit.set(key, windowed);
  return windowed.length >= RATE_LIMIT_MAX;
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const timestamps = rateLimit.get(key) ?? [];
  timestamps.push(now);
  rateLimit.set(key, timestamps);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

async function sendEmail({ to, subject, body }: { to: string; subject: string; body: string }): Promise<void> {
  if (!POSTMARK_TOKEN) {
    console.warn("[requestTrial] POSTMARK_SERVER_TOKEN not set; skipping email send");
    return;
  }
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: EMAIL_FROM,
      To: to,
      Subject: subject,
      TextBody: body,
      MessageStream: "outbound",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Postmark ${res.status}: ${text.slice(0, 200)}`);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return handleCors(origin);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, origin, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, origin, 400);
  }

  const { full_name, email, phone, company_name, company_size, message, turnstile_token } = body;

  if (!full_name?.trim() || !email?.trim() || !company_name?.trim()) {
    return json({ error: "Missing required fields" }, origin, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: "Invalid email address" }, origin, 400);
  }

  const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
  const emailKey = email.toLowerCase().trim();

  if (isRateLimited(emailKey) || isRateLimited(clientIp)) {
    return json({ error: "Too many requests. Please try again later." }, origin, 429);
  }

  if (TURNSTILE_SECRET && turnstile_token) {
    const ok = await verifyTurnstile(turnstile_token, clientIp);
    if (!ok) {
      return json({ error: "Turnstile challenge failed" }, origin, 403);
    }
  }

  try {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Trial Access Request - ${company_name}`,
      body: `New Trial Access Request:

Company: ${company_name}
Name: ${full_name}
Email: ${email}
Phone: ${phone || "N/A"}
Company Size: ${company_size || "N/A"}
Message: ${message || "N/A"}
`,
    });

    // Audit trail: log public trial request without PII in metadata
    await sb.from("form_submissions").insert({
      form_type: "demo",
      name: full_name,
      email: emailKey,
      phone: phone || null,
      message: `Company: ${company_name}\nSize: ${company_size || "N/A"}\n${message || ""}`,
      metadata: { source: "website", ip: clientIp },
      status: "new",
    });

    recordAttempt(emailKey);
    recordAttempt(clientIp);

    return json({ ok: true, message: "Request submitted" }, origin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[requestTrial] failed:", msg);
    return json({ error: "Submission failed. Please try again later." }, origin, 500);
  }
});
