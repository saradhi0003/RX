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
  on branch `feat/multi-tenancy-p0-1`, not yet applied).

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
use. **No MFA.** Session persists per-origin in the browser (so localhost and the
Vercel domain have independent sessions).

## Gotchas
- Free tier **auto-pauses after ~7 days idle** → app looks empty; restore in the
  dashboard (data preserved, no redeploy).
- Edge Functions/bots use the **service-role key → they BYPASS RLS** and the
  workspace-stamp trigger; post-012 they must set `workspace_id` explicitly.
