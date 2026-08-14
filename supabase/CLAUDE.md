# supabase — backend (Postgres + Auth + Edge Functions + Storage)

The whole backend. Frontend talks to it via the Supabase JS client
(`@/lib/supabase`) and `functions.invoke(...)`.

## migrations/
Ordered SQL, `00N_name.sql`, applied **manually** (Supabase SQL editor / CLI).
**Pushing a migration file does not run it.** They are additive; never rewrite a
shipped migration — add a new one.

- 001 schema · 002 **RLS** + `auth_is_admin()` · 003 demo users · 004 enterprise
  (`llm_usage`) · 005–007 import prep/upsert/unique fixes · 008 roles
  (admin/recruiter/accounts) · 009 expenses · 010 video calls · 011 bookings ·
  **012 multitenancy** (workspaces + `workspace_id` scoping + policy rewrite —
  on branch `feat/multi-tenancy-p0-1`, not yet applied) · 013–016 audit-trigger
  fix / UI field alignment / recruiter sync / signup approval ·
  **017 agents + agent_runs** and **018 approval_items** (on branch
  `feat/ai-core`, **staged — NOT applied**; DB paused. Apply 017 then 018 on a
  live/preview DB before merging that branch) · 019 security-definer view fix ·
  **020 approval RLS enforcement** · **021 SECURITY DEFINER RPC leak fix** ·
  022 signup notification (`user_profiles.notified_at`) ·
  **023 uploads bucket RLS** · **024 multitenancy** (the one that actually
  shipped; `auth_workspace_id()` + `workspace_id` scoping) · 025 llm settings ·
  026–028 applications→submissions cutover + status vocabularies ·
  029 self-bootstrap `workspace_id` fix · 030 audit-log `workspace_id` ·
  031 LLM fallback chain · **032 email accounts** (connected Gmail/Zoho
  mailboxes + `inbound_emails` classification columns) ·
  **033 email_accounts anon revoke** · **034 email_accounts narrow UPDATE**.
  017–**034** are **APPLIED** to the live project (017–022 on 2026-07-27;
  023 + 024 on 2026-08-03, re-verified 2026-08-08 — earlier revisions of this
  file wrongly called 023 "staged"). **032 verified applied 2026-08-14** by
  probing the live DB directly: `email_accounts` exists, the three
  `inbound_emails` columns exist, and `approval_items_type_check` already
  carries `email_intake`. **033 + 034 applied 2026-08-14** and verified: `anon`
  holds nothing on `email_accounts`, `authenticated` holds SELECT on the nine
  non-secret columns and UPDATE on `is_active` alone.

### 033 / 034 — 032 revoked the token columns from `authenticated` only
Verified live 2026-08-14: `authenticated` sees the intended 9 columns, but
**`anon` still had SELECT on all 15 — `access_token` and `refresh_token`
included.** 032 wrote `REVOKE SELECT … FROM authenticated` and Supabase's
default privileges grant new public-schema tables to *both* roles, so `anon` was
never narrowed.

Not a live leak: RLS is on and the only policy is `FOR ALL TO authenticated`, so
an anon request matches no policy and reads zero rows. It is a latent one — the
grant is all that stands between a future anon-readable policy (`blog_posts` is
the precedent here) and serving OAuth refresh tokens to anyone with the
publishable key, which ships in the browser bundle by design. 033 revokes anon
outright and drops `authenticated` to SELECT on the nine non-secret columns.

**034 finishes it.** Re-probing right after 033 showed `authenticated` still had
**table-wide UPDATE**, tokens included. Not a confidentiality hole — Postgres
requires column-level SELECT to *read* a column in any expression, so
`SET last_error = access_token` is refused and `UPDATE … RETURNING` can only
return SELECT-granted columns — but an integrity one: an admin could overwrite a
token with garbage and silently break that mailbox's polling. 034 narrows UPDATE
to `is_active`, the UI's only legitimate write (everything else runs as the
service role, which bypasses grants).

**Two lessons, both generalising:**
1. `REVOKE … FROM authenticated` is **half a revoke** — grants are per-role and
   Supabase seeds two (`anon` and `authenticated`).
2. A revoke on SELECT says nothing about UPDATE. Audit
   `information_schema.column_privileges` for **both roles and every privilege
   type** after any column-grant migration — and re-probe *after* applying,
   because the gap 034 closes was invisible until the SELECT fix was in place.

### 023 — the resume bucket never existed
Verified against the live project 2026-07-29: the `uploads` bucket **does not
exist** (Storage API returns `NoSuchBucket`; the only bucket is
`meeting-recordings`). `Core.UploadFile()` defaults to `uploads`, so every
upload entry point — bulk resume upload, candidate form, import modal, careers
form, AI quick actions — had been throwing "Bucket not found" since the Base44 →
Supabase migration. A second bug hid the first: `UploadFile()` returned
`{ url, path }` while all eight call sites destructured `{ file_url }`, so the
failure surfaced as `undefined` rather than an error anyone chased.

> ⚠ An earlier draft of this section claimed the bucket existed and was
> **public** — a live PII leak. That was wrong, inferred from `getPublicUrl()`
> in the client without checking the project. The inference runs backwards: the
> call failing does not imply a public bucket exists. Check the live surface
> before writing up a leak.

023 creates the bucket private with a 20 MB cap and a MIME allow-list enforced
by Storage itself, then adds four policies gated on `auth_is_approved()`. On
first apply it is a pure addition — no objects exist, nothing to migrate.
**Reads are shared, writes are per-user** — `(storage.foldername(name))[1] =
auth.uid()::text` on INSERT/UPDATE/DELETE. That split follows 020's reasoning:
this is a shared-workspace CRM, so a resume one recruiter uploads must be
readable by the colleague working the same requisition; FinTracker's per-user
read rule would hide every existing file from everyone. The per-user folder is
there so nobody can clobber or delete another recruiter's upload.

Going forward `candidates.resume_url` holds a storage **path**, rendered through
`@/components/common/FileLink` which signs on click.

**Legacy data, still outstanding:** existing `candidates.resume_url` values point
at **Base44 public URLs** (`https://base44.app/api/apps/.../files/public/...`).
Those objects sit on Base44's infrastructure, are readable by anyone with the
link, and are outside this project's RLS entirely — no migration here can reach
them. Migrating them into the `uploads` bucket (or revoking them at Base44) is
its own task. `FileLink` passes absolute URLs through unchanged so they keep
working meanwhile.

### 021 — a live PII leak, found by `supabase db advisors`
`search_candidates(text)` / `search_jobs(text)` were `SECURITY DEFINER`, so they
ran as the owner and **ignored RLS** — and PostgREST exposes them at
`/rest/v1/rpc/<name>` with `anon` holding EXECUTE. The anon key is public by
design (it ships in the browser bundle), so anyone could dump 50 candidate
records per query — name, email, phone, location — and paginate the table with
different search terms. Confirmed live before the fix; 020 did **not** cover it,
because SECURITY DEFINER is exactly what bypasses the policies 020 wrote.
021 flips both to `SECURITY INVOKER`, revokes anon's EXECUTE, pins `search_path`
on the remaining DEFINER functions, and revokes RPC access to trigger-only
functions.

**Do not "fix" the Advisor warning on `auth_is_approved()`/`auth_is_admin()` by
revoking EXECUTE** — RLS policy expressions run with the caller's privileges, so
that would break every gated query, and `anon` needs `auth_is_approved()` for
the public `blog_posts` policy. See the note in 021.

**Lesson:** a `SECURITY DEFINER` function that returns table rows is an RLS
bypass with a public URL. Prefer `SECURITY INVOKER` for anything data-returning.

### 020 — the approval gate is now enforced in the DB
016 added `user_profiles.status` / `is_locked` but only the **UI** honoured them
(`Layout.jsx` `isBlocked`, `AccessBlocker.jsx`); every data policy was still
`USING (auth.uid() IS NOT NULL)`, so an `invited` user could read the whole CRM
straight through PostgREST. 020 closes that:
- `auth_is_approved()` — status='active' AND NOT is_locked, `SECURITY DEFINER`
  with a pinned `search_path`. Now compiled into every data policy.
- `auth_is_admin()` hardened — a locked/inactive admin is no longer an admin.
- A `BEFORE INSERT OR UPDATE` trigger on `user_profiles` pins
  `role`/`status`/`is_locked`/`workspace_id` for non-admins. Without it the
  self-update policy let any user set their own `status='active'`.
- Gate is **approval only**, deliberately not `user_id = auth.uid()` — this is a
  shared-workspace CRM. Per-tenant scoping stays 012's job and composes with it.
- Guarded with `to_regclass()`, so it can be applied before or after 017/018.

**Exceptions on purpose:** `form_submissions` public insert (careers form),
`audit_logs` insert (unapproved users' denials must still be recorded), and
`user_profiles` self-read/self-insert (AuthContext bootstraps its own row and
must read its own status to render AccessBlocker).

### Rules for schema changes
- Every tenant table needs an **RLS policy** — the security boundary is here, not
  the client.
- Follow the additive pattern: add nullable column → backfill → `NOT NULL` →
  swap policies last (see 012 for the template).
- Global `UNIQUE(col)` breaks multi-tenancy → use `UNIQUE(workspace_id, col)`.
- Use the existing `set_updated_at()` trigger for `updated_at`.
- **Test on a preview project** before prod (`supabase db reset` locally).

## functions/
Deno Edge Functions — see [functions/CLAUDE.md](functions/CLAUDE.md).

## Auth
Password + magic-link OTP (`signInWithOtp`). Demo accounts auto-created on first
use. **TOTP MFA is live** (merged 2026-07-06 — `src/lib/mfa.js`, AAL2 step-up in
`AuthContext`); see [../AUTH_SETUP.md](../AUTH_SETUP.md). New signups land as
`status='invited'` and are locked out of all data by `auth_is_approved()` until
an admin approves them in Access Control. Session persists per-origin in the
browser (so localhost and the Vercel domain have independent sessions).

## Gotchas
- Free tier **auto-pauses after ~7 days idle** → app looks empty; restore in the
  dashboard (data preserved, no redeploy).
- Edge Functions/bots use the **service-role key → they BYPASS RLS** and the
  workspace-stamp trigger; post-012 they must set `workspace_id` explicitly.
