# botIngest — feeding email into Recruiter X from a bot

One endpoint for an external bot (the Grok routine) that reads Zoho / Gmail
itself and POSTs each message. The app classifies it and creates a **Job**, a
**Candidate**, an **Approval Queue** item (low confidence), stops a follow-up
(reply), or ignores it (spam) — the same pipeline as the Postmark webhook and
the connected-mailbox poller. Code: `supabase/functions/botIngest/`; the
validation rules live in `_shared/botIngestContract.ts`.

## Setup (once)

```bash
supabase secrets set BOT_WEBHOOK_SECRET=$(openssl rand -hex 32)
# optional, default 60; 0 disables
supabase secrets set BOT_INGEST_MAX_PER_MINUTE=60
# apply supabase/migrations/036_inbound_email_provenance.sql (SQL editor), then:
supabase functions deploy botIngest --no-verify-jwt
```

Without the secret the endpoint answers **503** to everything (fails closed).
Give the secret to the bot only; never put it in a `VITE_*` var.

## Request

`POST https://<project-ref>.supabase.co/functions/v1/botIngest`

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-webhook-secret` | the `BOT_WEBHOOK_SECRET` value |

| Field | Required | Notes |
|---|---|---|
| `source` | yes | `gmail` \| `zoho` \| `bot` (unspecified mailbox) |
| `message_id` | yes | **The provider's message id** — Gmail API `id`, Zoho `messageId`. Stable per message; it is the idempotency key. |
| `from_email` | yes | bare address or `"Name <addr>"` |
| `subject`, `body_text`, `body_html` | one of these or an attachment | |
| `attachments[]` | no | `{ filename, content_type, content_base64 }` — max 5, 5 MB each. PDF/DOCX resumes are text-extracted (first 2). |
| `in_reply_to` | no | the RFC `In-Reply-To` header — lets a candidate's reply stop their follow-up sequence |
| `from_name`, `to_email`, `thread_id`, `received_at` (ISO-8601) | no | |
| `workspace_id` | no | defaults to the default workspace |
| `connection_id` | no | an `email_accounts.id`; its workspace wins, its `source` must match |
| `raw_payload` | no | any JSON object ≤ 64 KB, kept for reference |

Whole body ≤ 12 MB. Classification always runs server-side — the bot sends the
raw message, it does not decide job vs. resume.

## Responses

| Status | Body | Meaning |
|---|---|---|
| 202 | `{status:"accepted", id, message_id, workspace_id, attachments_extracted}` | stored; processing continues in the background |
| 200 | `{status:"duplicate", id, message_id, processing_status}` | already have it — **treat as success**, mark it done |
| 400 | `{error, errors:[...]}` | fix the payload; every problem is listed |
| 401 | | wrong / missing secret |
| 409 | | the `connection_id` mailbox is disconnected or has no workspace |
| 413 | | body too large |
| 429 | `Retry-After: 60` | per-minute ceiling hit; retry later |
| 503 | | secret not set, or migration 036 not applied |

**Where did it go?** `GET …/botIngest?source=gmail&message_id=<id>` (same
header) → `{status, classification, confidence, entity_type, entity_id, error}`.
A `failed` message (e.g. LLM unreachable) is retried from **Email Inbox →
History** in the app; the bot should not resend it (it would get `duplicate`).

## Bot loop

1. Every 5–15 min, list new mail since your cursor.
2. For each message: POST it. On 202 or 200 → mark processed / advance the
   cursor. On 429 → wait `Retry-After`. On 5xx / network error → retry later
   with the same `message_id` (safe — it is idempotent). On 400 → log and skip.

## Examples

```bash
URL=https://<project-ref>.supabase.co/functions/v1/botIngest
curl -X POST "$URL" -H "Content-Type: application/json" -H "x-webhook-secret: $BOT_WEBHOOK_SECRET" -d '{
  "source": "gmail", "message_id": "18c2f0a1b2",
  "from_email": "Hiring Team <hiring@acme.com>",
  "subject": "Senior Java Developer — Dallas, TX (C2C)",
  "body_text": "We are hiring a Senior Java Developer, 8+ years, Spring Boot, AWS."
}'

# resume with attachment
curl -X POST "$URL" -H "Content-Type: application/json" -H "x-webhook-secret: $BOT_WEBHOOK_SECRET" -d "{
  \"source\": \"zoho\", \"message_id\": \"1700000000123\",
  \"from_email\": \"jane.doe@example.com\", \"subject\": \"Application — Data Engineer\",
  \"body_text\": \"Resume attached.\",
  \"attachments\": [{\"filename\": \"Jane_Doe_CV.pdf\", \"content_type\": \"application/pdf\",
                     \"content_base64\": \"$(base64 -w0 Jane_Doe_CV.pdf)\"}]
}"

# reply (stops the follow-up for that outreach)
curl -X POST "$URL" -H "Content-Type: application/json" -H "x-webhook-secret: $BOT_WEBHOOK_SECRET" -d '{
  "source": "gmail", "message_id": "18c2f0c9d4", "from_email": "jane.doe@example.com",
  "subject": "Re: Data Engineer role at Acme", "body_text": "Interested!",
  "in_reply_to": "<outreach-1@talentstack.example>"
}'
```

Rows from this endpoint show as **Bot** in Email Inbox → History
(`inbound_emails.ingest_channel = 'bot_ingest'`).
