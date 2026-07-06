# Zoho Mail → Recruiter X — MCP Ingestion Architecture

Goal: read the Zoho Mail inbox through an **MCP server**, classify each new
email as a **requirement (job)** or a **candidate (resume/profile)**, and load
it into Recruiter X — reusing the app's existing ingestion pipeline rather than
inventing a new one.

## 0. What already exists (reuse, don't rebuild)

| Piece | Where | Role in this design |
|---|---|---|
| Inbound email pipeline | `supabase/functions/inboundEmailWebhook` → `inbound_emails` table | The single entry point all mail flows into |
| AI classifier | `supabase/functions/_shared/classifier.ts` (`job / resume / reply / spam / unknown`) | Classifies message text |
| Resume parser | `supabase/functions/parseResumeFile` | Attachment → structured candidate |
| Job parser | `supabase/functions/aiRecruiterParseJob` | Requirement text → structured job |
| Review gate | Approval Queue (`email_drafts`, ApprovalQueue page) | Human confirmation before actions |
| Dedup | `inbound_emails.message_id UNIQUE` | Idempotent ingestion |

## 1. Architecture

```
┌─────────────┐   OAuth2 (Zoho)   ┌──────────────────────────┐
│  Zoho Mail   │◄─────────────────│  zoho-mail MCP server     │
│  (IMAP/REST) │                  │  (Node, stdio/HTTP MCP)   │
└─────────────┘                   │  tools:                   │
                                  │   • list_new_messages     │
                                  │   • get_message(id)       │
                                  │   • get_attachment(id)    │
                                  │   • mark_processed(id)    │
                                  └──────────┬───────────────┘
                                             │ MCP (tool calls)
                                  ┌──────────▼───────────────┐
                                  │  Ingestion Agent          │
                                  │  (Claude via Agent SDK,   │
                                  │   cron every N minutes)   │
                                  │  1. poll new messages     │
                                  │  2. classify: job │ cand. │
                                  │  3. extract fields (LLM)  │
                                  │  4. POST → Recruiter X    │
                                  └──────────┬───────────────┘
                                             │ HTTPS + x-webhook-secret
                              ┌──────────────▼──────────────────┐
                              │ Supabase Edge Function          │
                              │ inboundEmailWebhook (existing)  │
                              │ → inbound_emails row            │
                              │ → classifier / parsers          │
                              │ → candidates / jobs (+raw_data) │
                              │ → Approval Queue if configured  │
                              └─────────────────────────────────┘
```

**Key decision:** the MCP server only *reads mail*; the **agent** does the
reasoning; writes land through the **existing webhook**, so dedup, RLS,
workspace stamping (post-012), audit triggers, and the approval gate all apply
automatically.

## 2. Components

### 2.1 MCP server — use Zoho's official hosted MCP (primary)
Zoho ships a **hosted MCP platform** at `https://mcp.zoho.com` (MCP Client →
Server console). Use it instead of building our own:
1. Sign in at `mcp.zoho.com` → **MCP Server** → create/enable a server exposing
   **Zoho Mail** tools (grant read scopes only: messages/folders READ).
2. Zoho issues a **remote MCP endpoint URL + OAuth**; register it in the
   ingestion agent's MCP config (e.g. `claude mcp add --transport http zoho-mail <endpoint>`),
   completing the OAuth consent once.
3. The agent then calls Zoho-published tools (list/search messages, get
   message, get attachment). Exact tool names come from the server's tool list
   at connect time — treat them as the contract.

Managed auth, zero code, Zoho-maintained. **Fallback (self-hosted)** if the
hosted tools lack something (e.g. label-as-processed): a ~200-line Node MCP
server using Zoho Mail REST with OAuth2 refresh token (`ZohoMail.messages.READ`),
tools: `list_new_messages`, `get_message`, `get_attachment`, `mark_processed`.
If the hosted server has no label/flag tool, keep the poll cursor agent-side
(store `last_processed_ts` + processed ids in `app_settings`).

### 2.2 Ingestion agent (Claude Agent SDK or a `claude` cron routine)
- Runs on a schedule (e.g. every 10 min — the `/schedule` cloud routine or any
  cron host).
- Loop: `list_new_messages` → for each: `get_message` (+ attachments) →
  classify (`job` / `resume` / other) → extract structured fields → POST to
  `inboundEmailWebhook` with `x-webhook-secret` → `mark_processed`.
- Prompt contract mirrors `_shared/classifier.ts` labels so agent-side and
  server-side classification agree; server remains the source of truth.
- Budget: reuses `LLM_DAILY_COST_CEILING_USD`; agent batches ≤20 emails/run.

### 2.3 Recruiter X side (minimal changes)
- `inboundEmailWebhook` already accepts `{message_id, from, subject, body,
  attachments[]}` — add a `source: "zoho-mcp"` field for provenance.
- Post-012: stamp `workspace_id` from the connection owner
  (`channel_connections` row of type `zoho_mail`).
- New Channel Inbox filter chip: "Zoho Mail".

## 3. Data flow per classification

| Email type | Path | Result |
|---|---|---|
| **Requirement / JD** | webhook → `aiRecruiterParseJob` | `jobs` row (status `draft`) + optional auto-match run |
| **Candidate / resume** | webhook → `parseResumeFile` on attachment (else body extract) | `candidates` row + resume file in Storage |
| Reply to outreach | webhook → thread match on `thread_message_id` | attaches to `followup_schedules` / marks replied |
| Spam / unknown | webhook | `inbound_emails` row flagged `ignored` — nothing created |

Every row keeps `raw_data` (full original email JSON) for audit/replay —
matching the existing import pattern.

## 4. Security
- Zoho tokens live **only** in the MCP server's env — never in the browser or repo.
- Webhook protected by the existing `x-webhook-secret` (same pattern as bots)
  + rate limit.
- The agent has **read-only** mail scope; it cannot send or delete mail.
- All created records flow through RLS as the service role with explicit
  workspace stamping; approval-queue mode = no auto outreach without a human.

## 5. Build plan (increments)
1. **MCP server skeleton** — Zoho OAuth + `list/get` tools; verify with MCP
   inspector against a test mailbox. (~half day)
2. **Webhook provenance** — accept `source:"zoho-mcp"`; Channel Inbox chip. (small)
3. **Agent loop** — schedule + classify + POST + `mark_processed`; dry-run mode
   first (log, no write). (~half day)
4. **Attachment path** — resume PDFs → `parseResumeFile`. (small)
5. **E2E test** — seed mailbox with 1 JD + 1 resume + 1 spam; assert 1 job,
   1 candidate, 1 ignored; replay-safe (send twice → no dupes).
6. Post-012: workspace routing via `channel_connections`.

## 6. Alternative considered
Direct Zoho **webhook → Edge Function** (no MCP) is simpler for pure ingestion,
but the MCP route was chosen because it (a) matches the user's explicit intent,
(b) gives an agent read access for richer triage (threads, history, follow-up
questions), and (c) keeps Zoho credentials out of Supabase entirely.
