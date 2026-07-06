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
- **_shared/** — `supabaseClient.ts`, `llm.ts`, `classifier.ts`, `errorHandler.ts`.

## Conventions
- Use the service-role client from `_shared/supabaseClient.ts` for privileged
  writes; return via `okResponse`/`errResponse` (`_shared/errorHandler.ts`).
- Files carry `// @ts-nocheck` (Deno globals + esm.sh imports aren't visible to
  node-tsc) — expected, not a smell.
- Secrets come from Supabase Edge Function **secrets**, never `VITE_*`.

## ⚠ Multi-tenancy (post-migration-012)
Service role **bypasses RLS and the `workspace_id` stamp trigger**. Any INSERT
into a tenant table must set `workspace_id` explicitly, derived from the entity
being processed (e.g. `jobs.workspace_id` for a match run) or the inbound
`channel_connections.workspace_id`. This audit is **pending** on branch
`feat/multi-tenancy-p0-1`.

## Tests
`supabase functions serve <name>` + POST fixtures (assert status/shape/auth).
Unit-test pure `_shared/` helpers with Vitest. See [../../TESTING.md](../../TESTING.md)
layers 8, 12.
