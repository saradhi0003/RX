# Auth Setup — MFA, Email Verification, Custom Domain

> **STATUS 2026-07-06: DONE and verified.** MFA branch merged to main; Supabase
> auth config applied via Management API (confirm-email ON, site_url +
> redirect allow-list, password min 10 with mixed classes, HIBP leaked-password
> protection ON); all 3 demo users pre-confirmed; MFA proven e2e with a real
> TOTP flow (enroll → challenge → wrong-code reject → access). Remaining:
> custom SMTP (Resend/Postmark) for production-scale verification emails —
> built-in Supabase SMTP is ~2 emails/hour.
>
> **UPDATE 2026-07-27:** the admin-approval half was only ever enforced in the
> UI. Migration **020** + `functions/_shared/auth.ts` move it into the database
> and the Edge Functions — see §4. **Staged, not yet applied.**

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

## 4. Approval gate — enforced in the database (migration 020)

**Status: code staged on `feat/ai-core`, migration NOT yet applied** (DB paused).

Until 020 is applied the approval gate is **UI-only**. 016 added
`user_profiles.status` / `is_locked`, and `Layout.jsx` + `AccessBlocker.jsx`
honour them — but every data policy from 002 is still
`USING (auth.uid() IS NOT NULL)`. A signup sitting at `status='invited'` who
confirms their email holds a valid JWT and can read the entire CRM through
PostgREST without ever loading the React app.

`020_approval_rls_enforcement.sql` compiles `auth_is_approved()` into every data
policy, hardens `auth_is_admin()`, and adds a trigger that stops a user setting
their own `status`/`role` (the old self-update policy allowed exactly that).
`supabase/functions/_shared/auth.ts` is the server-side twin for Edge Functions,
which bypass RLS via the service role.

### Verifying it — the only test that actually proves anything
UI checks prove nothing here; the point is that the DB refuses. Sign in as an
unapproved user, grab their `access_token`, and hit PostgREST directly:

```bash
# 1. Get a token for an 'invited' user (or copy it out of localStorage)
curl -s "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"pending@example.com","password":"..."}' | jq -r .access_token

# 2. Try to read candidates with it — MUST return []
curl -s "$VITE_SUPABASE_URL/rest/v1/candidates?select=id,full_name&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"

# 3. Try to self-approve — MUST leave status unchanged ('invited')
curl -s -X PATCH "$VITE_SUPABASE_URL/rest/v1/user_profiles?id=eq.$USER_ID" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"active","role":"admin"}'

# 4. Try an Edge Function — MUST return 403, not a completion
curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/llmProxy" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prompt":"hello"}'
```

Then re-run steps 2 and 4 as an **approved** user — both must succeed, or the
gate is too tight. Also smoke-test an inbound Telegram/Slack/WhatsApp message
end-to-end: `channelMessageWebhook` fans out to other functions with the service
key, and that path must keep working.

## 5. SMTP — two layers (⚠ ONE MANUAL STEP OUTSTANDING)

Zoho SMTP credentials are live and verified against `smtppro.zoho.com:465` as
`noreply@talentstack.org` (they are in `.env.local`). Note the **Postmark**
token in `.env.local` is **invalid** and `POSTMARK_FROM_EMAIL` is still the
placeholder `recruiter@yourdomain.com` — which also means `sendApprovedDraft`
cannot currently send at all (it reads `postmark_token` / `from_email` from
`app_settings`, and neither row exists).

### Layer 2 — admin "access requested" notification (code DONE, secrets NOT set)
`notifySignupRequest` + `_shared/email.ts` are written, deployed and tested. It
is wired into `AuthContext` and fires whenever a profile loads as `invited`.
**It currently returns `{skipped:true, reason:"smtp_not_configured"}`** because
the Edge Functions have no SMTP secrets. To switch it on:

```bash
supabase secrets set \
  SMTP_HOST=smtppro.zoho.com SMTP_PORT=465 \
  SMTP_USER=<zoho user> SMTP_PASS=<zoho app password> \
  SMTP_SENDER=noreply@talentstack.org
```

(The values are already in `.env.local`. I was blocked from writing secrets, so
this step is yours.) Then verify: sign in as a pending user and confirm the
admin receives mail and `user_profiles.notified_at` gets stamped. Until then the
gate still works — Access Control lists pending requests regardless.

There is a **real pending request waiting right now**: `bigsyy2004@gmail.com`,
status `invited`, never notified.

### Layer 1 — custom SMTP for Supabase Auth emails (NOT done, deliberately)
Still the built-in sender at ~2 emails/hour. I did **not** change this: the CLI
only offers `supabase config push`, which pushes the whole `[auth]` block from
`config.toml` — and that file is configured for local dev
(`site_url = "http://localhost:5173"`, `enable_confirmations = false`). Pushing
it would have overwritten your production auth config and broken email
confirmation. Do it in **Dashboard → Authentication → Emails → SMTP Settings**
with the same Zoho values, which changes only SMTP.

## Deploy order (so nothing breaks)
1. Merge `feat/auth-mfa-email` **after** verifying login + MFA on a preview.
2. Flip on "Confirm email" + set Auth URLs **together** with the merge (the
   Register "verify your email" screen must be live first).
3. Add the domain in Vercel; wait for TLS; then point users at it.
