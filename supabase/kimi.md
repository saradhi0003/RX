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

Provider selection is automatic by model name prefix:
- `local/*` or `lmstudio/*` → LM Studio fleet via the tunnel (prefix stripped before sending; zero-cost, never matched by the family heuristics below)
- `claude-*` → Anthropic
- `deepseek-*` → DeepSeek (OpenAI-compatible)
- `qwen-*` / `alibaba-*` → Alibaba DashScope (OpenAI-compatible)
- `openai-compatible` → generic OpenAI-compatible endpoint
- `llama*`, `mistral*`, `phi*` → Ollama
- anything else → OpenAI

**Local-first with automatic fallback.** Settings default to `local/google/gemma-4-12b-qat` (free). If the primary call fails — tunnel down, key expired, provider 5xx — `_shared/llm.ts` walks the cost-ordered chain from `_shared/modelRouting.ts` (`fallbackCandidates`): `deepseek-chat` → `qwen-turbo` → `claude-3-5-haiku-20241022`, skipping providers with no key. The model that actually served is logged in `llm_usage`.

Cheapest options per provider:
- Local: any `local/<lmstudio-model-id>` — $0
- DeepSeek: `deepseek-chat`
- Alibaba: `qwen-turbo`
- Anthropic: `claude-3-5-haiku-20241022`

Local tunnel setup: run `./scripts/tunnel-lmstudio.sh` (needs LM Studio server on :1234 + cloudflared), then set `OPENAI_COMPATIBLE_BASE_URL` (tunnel URL) and `OPENAI_COMPATIBLE_API_KEY` (gateway secret from `.lmstudio-tunnel.local`) as Edge Function secrets. `healthCheck` probes the tunnel as `checks.local_fleet`.

The generic OpenAI-compatible endpoint reads `openai_compatible_base_url` / `openai_compatible_model` from `ai_recruiter_settings` first, then falls back to `OPENAI_COMPATIBLE_BASE_URL` / `OPENAI_COMPATIBLE_DEFAULT_MODEL` env secrets.

## Email intake (Gmail / Zoho → records)

Inbound email becomes Jobs/Candidates through ONE path: `_shared/emailProcessor.ts`.
Both `inboundEmailWebhook` (Postmark) and `pollEmailInboxes` (Gmail/Zoho OAuth, cron-gated,
5-min schedule) call `processInboundEmail(emailId)`. Never add a third intake path.

- `email_accounts` table (migration 027) holds OAuth tokens — browsers get column-grant SELECT
  on non-secret columns only; RLS is admin-per-workspace.
- Connect flow: `emailOAuthStart` (admin) → provider consent → `emailOAuthCallback`
  (verify_jwt=false, HMAC-signed state in `_shared/oauthState.ts`).
- Classification: `_shared/classifier.ts` (model = `parsing_model` from settings, local-first).
  Confidence ≥ 0.7 auto-creates via `_shared/parseJob.ts` / `_shared/parseCandidate.ts`
  (shared with aiRecruiterParseJob / parseResumeFile — same prompts); below → `approval_items`
  type `email_intake`; spam/unknown → ignored; replies stop follow-up sequences.
- Attachments: PDF/DOCX text extracted by `_shared/attachmentText.ts` (unpdf/mammoth),
  fed to classification + parsing. Payload mapping quirks live in `_shared/emailNormalizers.ts`
  (pure, Vitest-covered).

## Secrets

Server secrets are set in Supabase Edge Function secrets, not in `VITE_*` env vars.  
Common secrets: `LLM_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `ZOHO_OAUTH_CLIENT_ID`, `ZOHO_OAUTH_CLIENT_SECRET`, `EMAIL_OAUTH_REDIRECT_URL`, `APP_URL`, `POSTMARK_SERVER_TOKEN`, `CHANNEL_BOT_SECRET`, `CRON_SECRET`, `INTERNAL_FUNCTION_TOKEN`.

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
