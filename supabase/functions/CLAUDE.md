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
- **emailOAuthStart** (admin) / **emailOAuthCallback** (`verify_jwt = false`) /
  **pollEmailInboxes** (cron) — the connected-mailbox intake; see "Email intake"
  below.
- **createWhatsappRegistrationCode / validateWhatsappRegistrationCode**,
  **parseResumeFile**, **healthCheck** (integrations liveness).
- **notifySignupRequest** — emails the admins when a signup lands at
  status='invited'. Best-effort: no SMTP secrets → `{skipped:true}` and
  `notified_at` stays NULL so the next sign-in retries. Needs
  `SMTP_HOST/PORT/USER/PASS/SENDER` secrets (see AUTH_SETUP.md §5).
- **_shared/** — `supabaseClient.ts`, `llm.ts`, `classifier.ts`, `errorHandler.ts`,
  `pii.ts`, `env.ts`, **`auth.ts`**, `pricing.ts`, `modelRouting.ts`, and the
  email-intake set: `emailProcessor.ts`, `emailNormalizers.ts`, `parseJob.ts`,
  `parseCandidate.ts`, `attachmentText.ts`, `oauthState.ts`.

## Model routing — the `local/` prefix
`modelRouting.ts` decides which provider serves a model id. It is a separate
module from `llm.ts` so `npm test` can cover it: `llm.ts` imports the OpenAI and
Anthropic SDKs via Deno `npm:` specifiers, which Vitest cannot resolve.

`detectProvider()` reads **family names** (`qwen*` → DashScope, `llama*` →
Ollama, `claude*` → Anthropic). A family name says what a model *is*, never
where it is served from — so a locally-served `qwen2.5-coder-14b` would be sent
to Alibaba's cloud, egressing prompt content (candidate PII) and billing for it.
Prefix a model id with **`local/`** (or `lmstudio/`) to force it to the LM Studio
fleet published by `./scripts/tunnel-lmstudio.sh`; the prefix is checked before
every heuristic. The bare id goes on the wire, but `llm_usage` records the
prefixed form so `pricing.ts` zeroes it — otherwise free local calls burn the
daily ceiling that gates the paid providers.

`OPENAI_COMPATIBLE_API_KEY` on that path is the **gateway's shared secret**, not
a provider credential. `healthCheck` probes the tunnel as `local_fleet`,
deliberately `optional` so a closed laptop lid can't 503 a production endpoint.

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

## Email intake — connected mailboxes (migration 032)
Two entry points, **one intake path**: `inboundEmailWebhook` (Postmark) and
`pollEmailInboxes` (Gmail/Zoho OAuth polling) both hand off to
`_shared/emailProcessor.ts`, which classifies → routes:
reply stops the follow-up sequence; job/resume at **≥ 0.7 confidence**
(`CONFIDENCE_THRESHOLD` in `emailNormalizers.ts`) creates the record through the
same prompts as the upload flow (`parseJob.ts` / `parseCandidate.ts`); below the
threshold it files an `approval_items` row of type `email_intake`; spam/unknown
is ignored. It never throws — a failed email lands in `processing_status='failed'`
with `error_message` so one bad message can't stall a mailbox.

**`failed` and `ignored` are not interchangeable.** `ignored` is terminal —
`processInboundEmail` refuses to reprocess it — so it is only used for a verdict
the classifier actually reached. Anything that *went wrong* (LLM unreachable,
daily cost ceiling hit) must be `failed`, which stays replayable; that is why
`classifyMessage` returns a `failed` flag instead of passing an outage off as a
confident `"unknown"`. The intake path calls `checkDailyCeiling()` like every
other LLM entry point — it is two model calls per email and is reachable from a
public webhook.

**Reply matching is not a string compare.** Postmark's send API hands back a
bare GUID (stored in `sent_emails.message_id`) while the reply carries
`<guid@mtasv.net>`, so `_shared/emailNormalizers.ts` `messageIdCandidates()`
generates every form and the lookup uses `.in(...)`. Zoho's list payload has no
threading headers at all, so there is a second path: a `Re:` subject matched
against recent sends to that address (`normalizeSubject`). Without both, the
stop-on-reply half of the follow-up system is silently dead.

`inboundEmailWebhook` acknowledges Postmark as soon as the row is durable and
finishes the intake in `EdgeRuntime.waitUntil()` — classify+parse is far longer
than a webhook should hold its caller, and Postmark retries on timeout, which
would duplicate the work.

**Connecting a mailbox:** `emailOAuthStart` (**admin only** — a mailbox imports
data for the whole workspace) returns the provider consent URL carrying an
HMAC-signed `state`; the provider redirects to `emailOAuthCallback`, which runs
with `verify_jwt = false` because Google/Zoho arrive with no session. **The
signed state is the entire authentication of that endpoint** (`_shared/oauthState.ts`,
signed with the service-role key, 15-minute expiry) — don't loosen it.

**Tokens never reach the browser.** 032 revokes table-wide SELECT on
`email_accounts` and grants only the non-secret columns. Postgres rejects a
`SELECT *` against a column-granted table outright, so the UI must name its
columns — that is what `@/entities/EmailAccount` (and the `columns` option on
`createEntity`) exists for. A plain `createEntity("email_accounts")` makes the
settings page fail to load, and it fails *looking like* "no mailboxes connected".

**Workspace stamping:** the poller runs as the service role, so it must carry
`email_accounts.workspace_id` onto every `inbound_emails` row it inserts —
selecting the account without `workspace_id` silently files every tenant's mail
under `DEFAULT_WORKSPACE_ID`. Same rule as the Multi-tenancy section below.

**Secrets** (Edge Function secrets, never `VITE_*`): `GOOGLE_OAUTH_CLIENT_ID` /
`GOOGLE_OAUTH_CLIENT_SECRET`, `ZOHO_OAUTH_CLIENT_ID` / `ZOHO_OAUTH_CLIENT_SECRET`,
`CRON_SECRET`, and optionally `EMAIL_OAUTH_REDIRECT_URL` (defaults to
`<SUPABASE_URL>/functions/v1/emailOAuthCallback`) and `APP_URL` (where the
callback lands the browser). The redirect URI must be registered verbatim in the
Google and Zoho consent-screen config. `pollEmailInboxes` is driven by a
Supabase **scheduled trigger** every 5 min sending `x-cron-secret` — created in
the Dashboard, not in a migration, since the secret must not live in SQL.

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
