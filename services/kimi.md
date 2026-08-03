# services/kimi.md — Bot services guidance

## Scope

`services/` contains the external bot runtimes hosted on Railway:
- `services/telegram-bot/`
- `services/slack-bot/`
- `services/whatsapp-bot/`

## Architecture

- Bots receive messages from Telegram/Slack/WhatsApp APIs.
- They forward structured payloads to the Supabase Edge Function `channelMessageWebhook`.
- Bots hold **no service-role key**; they authenticate with `CHANNEL_BOT_SECRET`.
- The backend twin for access control is the Edge Function, which calls `requireApprovedUser`.

## Common patterns

- Keyword/regex pre-filter before forwarding to save LLM cost.
- Parse attachments minimally; send raw payload reference to backend.
- WhatsApp bot uses Twilio API.
- Slack bot uses Slack Bolt in HTTP mode.
- Telegram bot uses `node-telegram-bot-api`.

## Token-saving lookups

- Webhook auth: `ARCHITECTURE.md` §7.6.
- Channel ingestion schema: `ARCHITECTURE.md` §8.5.
- Backend handling: `../supabase/kimi.md` → `channelMessageWebhook`.

## Common tasks (cookbook)

### Add a new bot channel
1. Create new bot directory under `services/`.
2. Implement webhook receiver and forwarding to `channelMessageWebhook`.
3. Add auth via `Authorization: Bearer CHANNEL_BOT_SECRET`.
4. Add channel type handling in `supabase/functions/channelMessageWebhook/index.ts`.
5. Add DB table/RLS for channel connection if needed.

### Fix a bot forwarding bug
1. Check payload shape matches what `channelMessageWebhook` expects.
2. Verify signature/secret.
3. Add logs locally; avoid adding heavy dependencies.
