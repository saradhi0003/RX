# supabase/functions — Edge Functions (Deno)

Server-side logic and the place API keys live. Called from the app via
`supabase.functions.invoke("<name>", { body })` or webhooks.

## Functions
- **llmProxy** — the LLM gateway; all `@/lib/llm` calls route here so keys stay
  server-side. Verify JWT ON.
- **livekitToken** — mints LiveKit JWTs. **Verify JWT OFF**.
- **transcribeRecording** — Storage `.webm` → Whisper → transcript (+ booking
  summary/action items). ~25 MB Whisper cap.
- **scheduledFollowupRun** — daily cron; sends due follow-ups.
- **aiRecruiterParseJob / MatchCandidates / DraftEmail / ApproveDraft** — the AI
  recruiter pipeline stages.
- **sendApprovedDraft**, **stopFollowup** — execution actions.
- **inboundEmailWebhook**, **channelMessageWebhook**, **reprocessChannelMessage**
  — inbound ingestion (email / Telegram / Slack / WhatsApp).
- **createWhatsappRegistrationCode / validateWhatsappRegistrationCode**,
  **parseResumeFile**, **healthCheck** (integrations liveness).
- **notifySignupRequest** — emails the admins when a signup lands at
  status='invited'. Best-effort: no SMTP secrets → `{skipped:true}` and
  `notified_at` stays NULL so the next sign-in retries. Needs
  `SMTP_HOST/PORT/USER/PASS/SENDER` secrets (see AUTH_SETUP.md §5).
- **_shared/** — `supabaseClient.ts`, `llm.ts`, `classifier.ts`, `errorHandler.ts`,
  `pii.ts`, `env.ts`, **`auth.ts`**.

## ⚠ Approval gate — `_shared/auth.ts`
`verify_jwt` proves the caller is *authenticated*, not *approved*. Since the
service-role client bypasses RLS (and therefore `auth_is_approved()` from
migration 020), every user-invoked function re-checks approval itself:

```ts
const gate = await requireApprovedUser(req);   // or requireAdminUser
if (gate.response) return gate.response;       // 401/403 already formed
```

Wired into: llmProxy, all four aiRecruiter\*, sendApprovedDraft, stopFollowup,
parseResumeFile, transcribeRecording, reprocessChannelMessage, livekitToken, and
createWhatsappRegistrationCode (admin). **Add it to any new user-invoked
function.**

Deliberately NOT gated: the webhooks (`channelMessageWebhook`,
`inboundEmailWebhook`, `validateWhatsappRegistrationCode` — external callers with
no session), `healthCheck`, `scheduledFollowupRun` (cron, gated by
`CRON_SECRET`), and **`notifySignupRequest`** — that one exists precisely to
serve an unapproved caller, so it uses `getCallerUser()` (authenticate only) and
must never be "fixed" to use `requireApprovedUser`.

`requireApprovedUser` verifies the JWT itself, so it works on functions deployed
with `verify_jwt = false` (that is what now protects `livekitToken`). It also
recognises the **service key as a trusted internal caller** — required because
`channelMessageWebhook` fans out to `aiRecruiterParseJob` / `parseResumeFile`
with `Bearer $SERVICE_KEY` and there is no end user in that chain.

## Conventions
- Use the service-role client from `_shared/supabaseClient.ts` for privileged
  writes; return via `okResponse`/`errResponse` (`_shared/errorHandler.ts`).
- Files carry `// @ts-nocheck` (Deno globals + esm.sh imports aren't visible to
  node-tsc) — expected, not a smell.
- Secrets come from Supabase Edge Function **secrets**, never `VITE_*`.

## ⚠ Multi-tenancy (post-migration-024)
Service role **bypasses RLS and the `workspace_id` stamp trigger**. Any INSERT
into a tenant table must set `workspace_id` explicitly: user-gated functions
use `gate.profile.workspace_id` (`_shared/auth.ts`); the cron/webhook functions
resolve it from the entity being processed (`followup_schedules.workspace_id`,
`channel_connections.workspace_id`) or fall back to `DEFAULT_WORKSPACE_ID`.
The audit of all existing functions is done (2026-08-03) — keep the rule for
every new INSERT you add.

## Tests
`supabase functions serve <name>` + POST fixtures (assert status/shape/auth).
Unit-test pure `_shared/` helpers with Vitest. See [../../TESTING.md](../../TESTING.md)
layers 8, 12.
