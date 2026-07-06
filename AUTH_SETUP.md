# Auth Setup — MFA, Email Verification, Custom Domain

> **STATUS 2026-07-06: DONE and verified.** MFA branch merged to main; Supabase
> auth config applied via Management API (confirm-email ON, site_url +
> redirect allow-list, password min 10 with mixed classes, HIBP leaked-password
> protection ON); all 3 demo users pre-confirmed; MFA proven e2e with a real
> TOTP flow (enroll → challenge → wrong-code reject → access). Remaining:
> custom SMTP (Resend/Postmark) for production-scale verification emails —
> built-in Supabase SMTP is ~2 emails/hour.

App-side code for all three is implemented (branch `feat/auth-mfa-email`). This
file lists the **dashboard steps** that must be done alongside it — code alone
isn't enough.

## 1. MFA (TOTP) — mostly code, one optional dashboard step

**Code (done):** `src/lib/mfa.js`, `src/components/auth/MfaChallenge.jsx`,
`src/pages/Security.jsx` (enroll/manage, linked from the user menu → "Security &
2FA"), AAL tracking in `AuthContext`, and the login gate in `Login.jsx` +
`App.jsx` route guards.

**How it works:**
- A user enrolls at **/Security** → scans the QR in an authenticator app →
  verifies a 6-digit code. The factor becomes `verified`.
- On their next sign-in, after the password step the app checks the assurance
  level; if a verified factor exists (`aal1 → aal2` required), it shows the TOTP
  challenge and only then reaches the app. Reloads mid-session re-prompt.

**Dashboard:** Supabase TOTP MFA is enabled by default — no toggle needed. (Only
if your project disabled it: Supabase → Authentication → **Providers/Settings →
Multi-Factor Auth → enable TOTP**.) MFA is currently **opt-in per user**; to make
it mandatory org-wide, enforce it in onboarding (future).

**Testing:** unit-tested in `tests/unit/auth/mfa.test.js`. Full e2e needs a real
TOTP secret (generate codes with an `otplib`-based test helper) — see TESTING.md
layer 19.

## 2. Email verification — code + a required toggle

**Code (done):** `Register.jsx` detects the "no session after signup" case
(which is what "Confirm email" produces) and shows a **"Verify your email"**
screen instead of proceeding; the sign-up link redirects back to `/Login`.
`Login.jsx` already surfaces an "email not confirmed" message.

**Dashboard (required to actually turn it on):**
1. Supabase → **Authentication → Providers → Email → enable "Confirm email".**
2. Supabase → **Authentication → URL Configuration:**
   - **Site URL** = your production URL (`https://<your-domain>` once DNS is live,
     else `https://rx-self.vercel.app`).
   - **Redirect URLs** — add every origin used: the custom domain, the Vercel
     URL, and `http://localhost:5173` for local dev. Without these, the
     confirmation link won't return to the app.
3. (Optional) customize the confirmation email under **Authentication → Email
   Templates.**

> ⚠️ With "Confirm email" ON, the **demo-account buttons and any auto-create
> sign-in flow require a confirmed address** — demo users won't get a session
> until confirmed. Keep it OFF in dev, or pre-confirm the demo users.

## 3. Custom domain (apex + www)

**DNS (IONOS) — done:** `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`;
all IONOS **mail** records (MX, SPF TXT, DKIM, DMARC, autodiscover) left intact.

**Remaining:**
1. **Vercel → `rx` → Settings → Domains → Add** the apex + `www` (Vercel verifies
   the records and issues TLS). Set the apex as primary; `www` redirects to it.
2. **Update Supabase Auth URL Configuration** (see §2.2) to the new domain, or
   magic-link / email-confirm / OAuth redirects break on the live domain.
3. Optionally set `VITE_APP_URL` in Vercel to the new URL and redeploy.

## Deploy order (so nothing breaks)
1. Merge `feat/auth-mfa-email` **after** verifying login + MFA on a preview.
2. Flip on "Confirm email" + set Auth URLs **together** with the merge (the
   Register "verify your email" screen must be live first).
3. Add the domain in Vercel; wait for TLS; then point users at it.
