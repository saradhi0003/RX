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
  **023 uploads bucket RLS** · **024 multitenancy** (workspaces + `workspace_id`
  + policy rewrite) · **025 agent-table tenancy + advisor fixes**.
  017–**022** applied 2026-07-27. **023 and 024 applied & verified 2026-08-03.**
  **025 applied & verified 2026-08-08** (`verify_025_agent_tenancy.sql` 10/10
  PASS; `supabase db advisors` security lints 16 → 6, and the 6 remaining are the
  three auth helpers that 021 says must stay executable).

### 025 — the three tables 024 forgot
024 workspace-scopes every tenant table by iterating a hardcoded
`tenant_tables[]` array. That array **omits `agents`, `agent_runs` and
`approval_items`** — they arrived in 017/018, which were still staged on
`feat/ai-core` when 024 was written. So those three kept the policy 020 gave
them: approval-gated but **not** workspace-scoped.

Verified live before writing 025:
```
agents / agent_runs / approval_items  ->  USING auth_is_approved()
candidates                            ->  USING (workspace_id = auth_workspace_id()
                                                 AND auth_is_approved())
```
**The approval gate is holding** — the legacy policy *name*
(`agents_all_authenticated`) is misleading, because 020 rewrote the body and
kept the name. Audit policy **bodies**, not names; a name-only check reports a
false positive here. The real gap is cross-tenant: any approved user of
workspace B can read and write workspace A's agents, runs and approval items.
Latent while only one workspace exists, live the moment a second one does.

025 brings all three into the 024 pattern (FK, backfill, NOT NULL, index, stamp
trigger, `workspace_all` policy), and clears four `supabase db advisors`
findings: `audit_entity_change`, `rls_auto_enable`, `sync_recruiter_from_profile`
and `guard_user_profile_privileges` were still `EXECUTE`-able by `anon` at
`/rest/v1/rpc/<name>` (021 intended to revoke these and missed them), plus a
pinned `search_path` on `stamp_workspace_id` and `immutable_array_to_string`.
Zero-risk to apply: all three tables are empty, so there is nothing to backfill.
Verify with `scripts/verify_025_agent_tenancy.sql`.

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
- **Always re-run the verify script after applying a migration.** Do not trust a
  "success" message, and do not trust a report that it was applied. When 025 was
  applied via the SQL editor it twice left the database **byte-identical** —
  which reads like "the migration was a no-op" rather than "it never landed".
  Only re-querying the live catalog caught it. A `BEGIN…COMMIT` migration that
  fails rolls back completely and leaves no trace, so absence of change is not
  evidence of absence of intent.
- **Schema-qualify every identifier** (`public.candidates`, not `candidates`)
  and pin `SET LOCAL search_path = public, pg_catalog;` after `BEGIN`. This is
  defensive practice, not a fix for the above — the unqualified version ran fine
  when executed directly, so qualification was *not* what made 025 land. But one
  bare `user_profiles` in `verify_025` did genuinely throw
  `42P01 relation does not exist` in the SQL editor, so the hazard is real for
  scripts as well as migrations.
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
