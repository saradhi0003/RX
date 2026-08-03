# supabase/kimi.md — Backend guidance

## Scope

Everything under `supabase/`: Edge Functions (Deno), migrations (Postgres), and config.

## Edge Functions

Located at `supabase/functions/<name>/index.ts`. Runtime: Deno.

### Key functions

| Function | Purpose |
|----------|---------|
| `inboundEmailWebhook` | Postmark inbound email |
| `channelMessageWebhook` | Telegram/Slack/WhatsApp inbound |
| `aiRecruiterParseJob` | Parse job text → Job row |
| `aiRecruiterMatchCandidates` | LLM score candidates |
| `aiRecruiterDraftEmail` | Generate email drafts |
| `aiRecruiterApproveDraft` | Approve/reject drafts |
| `sendApprovedDraft` | Send via Postmark |
| `scheduledFollowupRun` | Daily cron follow-up drafts |
| `llmProxy` | Routes LLM calls, keeps keys server-side |
| `healthCheck` | Service health |

### Shared code

- `supabase/functions/_shared/` — shared helpers (auth, db, LLM, PII scrubbing).
- Import with `import { ... } from "../_shared/<file>.ts"`.

### Auth helpers

- `requireApprovedUser(req)` — `supabase/functions/_shared/auth.ts`.
- `auth_is_admin()` — SQL helper in migrations.

## Migrations

- Files: `supabase/migrations/00N_name.sql`.
- **Applied manually** — pushing the file does not run it.
- Keep additive and ordered. New migrations use the next integer.
- RLS: enable on every new table and add policies.

## Database conventions

- Tables use `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- `updated_at` auto-set by trigger on mutable tables.
- `created_by TEXT` on most tables.
- Frontend-compatible `created_date` alias is added by `entityFactory`, not the DB.

## RLS

RLS is the security boundary. Never rely on the client filtering.

- Every table has RLS enabled.
- Common policy shape: `USING (auth_is_approved())` for reads.
- Admin-only: `auth_is_admin()`.
- Approval gate is enforced by migration `020` (`auth_is_approved()` and hardened `auth_is_admin()`).

## LLM from backend

```ts
const { callLLM } = await import("../_shared/llm.ts");
const result = await callLLM(system, user);
```

Provider selection via `LLM_PROVIDER` env var (default `openai`). Fallback chain is handled internally.

## Secrets

Server secrets are set in Supabase Edge Function secrets, not in `VITE_*` env vars.  
Common secrets: `LLM_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `POSTMARK_SERVER_TOKEN`, `CHANNEL_BOT_SECRET`, `CRON_SECRET`, `INTERNAL_FUNCTION_TOKEN`.

## Token-saving lookups

- Function catalog details: `ARCHITECTURE.md` §5.
- Data model details: `ARCHITECTURE.md` §8.
- RLS details: `ARCHITECTURE.md` §7.4.

## Common tasks (cookbook)

### Add a new Edge Function
1. Create `supabase/functions/myFunc/index.ts`.
2. Re-export Deno.serve handler.
3. Add shared helper imports from `../_shared/`.
4. Add tests under `tests/` if applicable.

### Add a new table
1. Add migration `supabase/migrations/00N_table.sql`.
2. Enable RLS.
3. Add policies using `auth_is_approved()` / `auth_is_admin()`.
4. Add trigger for `updated_at` if mutable.
5. Add to `ARCHITECTURE.md` §8 if user-facing schema doc matters.

### Modify RLS
1. Update migration or create a new one.
2. Re-verify with curl tests in `AUTH_SETUP.md` §4 after applying.
3. Remember service-role calls bypass RLS — use `requireApprovedUser` in Edge Functions.
