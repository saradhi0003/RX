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
  **020 approval RLS enforcement** · **021 SECURITY DEFINER RPC leak fix**.
  017–021 are all **APPLIED** to the live project as of 2026-07-27.

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
