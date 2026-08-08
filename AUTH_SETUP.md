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
>
> **UPDATE 2026-07-29 (FinTracker feature port):** added idle sign-out (§6),
> private upload storage (§7, migration **023**), and an installable Expo mobile
> app (§8). The pattern doc these follow is vendored at
> [skills/mfa-totp/](skills/mfa-totp/) — read it before changing any of the
> gates. **Migration 023 is staged, not applied.**

App-side code for all three is implemented (branch `feat/auth-mfa-email`). This
file lists the **dashboard steps** that must be done alongside it — code alone
isn't enough.

## Current outstanding manual steps (as of 2026-08-03)

These are the remaining configuration steps; none are code changes.

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Apply migration `023_uploads_bucket_rls.sql` | Supabase SQL editor | ✅ Applied & verified 2026-08-03 |
| 2 | Apply migration `024_multitenancy.sql` | Supabase SQL editor | ✅ Applied & verified 2026-08-03 (fixed helper ordering first — SQL fn creation must follow the TEXT→UUID column conversion) |
| 3 | Deploy the stamped Edge Functions | `supabase functions deploy <name> --project-ref <ref>` | ✅ Done 2026-08-03 — all 19. ⚠ `--project-ref` deploys ignore `verify_jwt` in config.toml; the 6 public endpoints needed an explicit `--no-verify-jwt` redeploy |
| 4 | Set SMTP secrets for `notifySignupRequest` | `supabase secrets set` (see §5) | ✅ Done 2026-08-03 (`SMTP_HOST/PORT/USER/PASS/SENDER`) |
| 5 | Configure Supabase Auth SMTP (Layer 1) | Dashboard → Authentication → Emails → SMTP Settings (see §5) | ⬜ Manual — dashboard only, no API |
| 6 | Initialize EAS for mobile app | `mobile/` with `EXPO_TOKEN` | ✅ Done 2026-08-03 — project `@saradhi0003s-team/recruiter-x`, `update:configure` applied, `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` set for all 3 profiles |

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

**Status: APPLIED to the live project (2026-07-27) and verified end-to-end.**
The history below is kept because it explains *why* the migration exists.

Before 020 the approval gate was **UI-only**. 016 added
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

## 6. Idle sign-out (code only — no dashboard step)

`src/hooks/useIdleLogout.js`, wired once in `AuthContext`. Supabase's
`autoRefreshToken` renews the JWT indefinitely while a tab is open, so an
abandoned laptop keeps a live CRM session — full candidate PII — until the
browser closes. This signs out after **20 minutes** idle.

Two details worth not "simplifying" away:
- the last-activity clock lives in `localStorage`, so idle time while the tab
  was **closed** still counts (an in-memory timer resets on every restore, which
  on a phone browser means the session never expires);
- expiry is decided by **two** racers — a 30 s interval *and* a
  `visibilitychange` re-check — because mobile browsers freeze timers while
  backgrounded.

To change the window, edit `IDLE_LOGOUT_MS`. Note mobile does **not** inherit
this: the Expo app keeps the session and re-locks behind biometrics instead
(see §8).

## 7. Upload storage — private bucket (migration 023) ✅ APPLIED

**Status: applied & verified 2026-08-03** (see the status table in §"Current
outstanding manual steps"). This section previously read "staged, NOT applied"
and contradicted that table — corrected 2026-08-08.

Before it was applied, the `uploads` bucket did not exist on the live project
(verified 2026-07-29 — the Storage API returned `NoSuchBucket`).
`Core.UploadFile()` defaults to it, so every upload path had been failing with
"Bucket not found" since the Base44 → Supabase migration; the `{ file_url }`
destructuring bug turned that error into a silent `undefined`.

Migration 023 creates it private with a 20 MB cap and a MIME allow-list, and
adds policies gated on `auth_is_approved()` — reads shared across the workspace,
writes confined to `<user-id>/…` so nobody can clobber a colleague's file.
On first apply it is a pure addition: no objects, nothing to migrate.

> ⚠ Correction: an earlier draft of this section said the bucket was public and
> leaking resumes. That was inferred from `getPublicUrl()` in the client code
> without checking the project, and it was wrong.

`Core.UploadFile()` now returns a short-lived **signed** URL plus a durable
`path`. **`candidates.resume_url` stores the path**, rendered via
`@/components/common/FileLink` (which signs on click). Storing the signed URL
would produce links that die within the hour.

### Verifying it — again, the UI proves nothing
```bash
# Was readable by the whole internet; must now fail with no key.
curl -s "$VITE_SUPABASE_URL/storage/v1/object/public/uploads/<path>"

# An approved user's signed URL must still work.
curl -s "$VITE_SUPABASE_URL/storage/v1/object/sign/uploads/<path>" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"

# Writing outside your own folder must be refused (uploads_insert).
curl -s -X POST "$VITE_SUPABASE_URL/storage/v1/object/uploads/someone-else/x.pdf" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  --data-binary @small.pdf
```

**Legacy resumes are a separate, still-open problem.** Existing
`candidates.resume_url` values point at **Base44 public URLs**
(`https://base44.app/api/apps/.../files/public/...`) — readable by anyone with
the link, hosted outside this Supabase project, and unreachable by any migration
here. Moving them into the `uploads` bucket, or revoking them at Base44, is its
own task. `<FileLink>` passes absolute URLs through unchanged, so they keep
working in the meantime.

## 8. Mobile app (Expo) — a second client, same backend

[mobile/](mobile/) is an Expo app on the **same** Supabase project, Edge
Functions and RLS. Nothing server-side was duplicated. It implements the same
cascade as the web (`session → MFA → biometric lock → approval → app`), and the
same upload contract.

Setup, the EAS build/OTA split, and a verification checklist are in
[mobile/README.md](mobile/README.md). Two things need **your** Expo account
before it can build: `eas init` (writes `extra.eas.projectId`) and
`eas update:configure` (writes `updates.url`). Both are deliberately absent from
the committed `app.json` because they name a specific EAS project.

Mobile session policy differs from web on purpose: it **keeps** the session and
re-locks behind device biometrics rather than signing out at 20 minutes. A
device with no biometrics enrolled is let straight in — hard-locking there would
strand a user out of their own account for no gain, since the session and RLS
are the real boundary.

## Deploy order (so nothing breaks)
1. Merge `feat/auth-mfa-email` **after** verifying login + MFA on a preview.
2. Flip on "Confirm email" + set Auth URLs **together** with the merge (the
   Register "verify your email" screen must be live first).
3. Add the domain in Vercel; wait for TLS; then point users at it.
4. Apply migration **023** before merging the upload changes — the new
   `UploadFile` signs URLs against a private bucket, so it needs 023 live.
