-- ═══════════════════════════════════════════════════════════════════════════
-- 036_inbound_email_provenance.sql — record where each inbound email came from.
--
-- WHY
-- inbound_emails now has four writers and no way to tell their rows apart:
--   postmark_webhook  inboundEmailWebhook (Postmark inbound stream)
--   mailbox_poll      pollEmailInboxes    (Gmail/Zoho OAuth mailboxes, 032)
--   bot_ingest        botIngest           (external bot POSTing mail it fetched)
--   manual            EmailInbox "Paste Email" tab (an authenticated user)
-- Two columns, because they answer different questions:
--   ingest_channel  HOW it arrived   — the filter the inbox needs ("via bot")
--   source          WHICH mail system — postmark | gmail | zoho | bot
--                   ('bot' = the bot did not say which mailbox it read)
--
-- The existing writers are deliberately NOT changed to name these columns.
-- A BEFORE INSERT trigger derives them when the writer leaves them NULL, so
-- this migration and the function deploys can land in either order without
-- breaking the Postmark path: an un-updated function never names a column
-- that might not exist yet. Only botIngest writes them explicitly — and it is
-- new, so it cannot be deployed against a schema without them by accident
-- (it returns a 503 naming this migration if it is).
--
-- Backfill: verified live 2026-10-28 — the 3 existing rows have no mailbox and
-- a NULL raw_payload (no Postmark MessageID), i.e. manual pastes.
--
-- Additive and idempotent. Apply after 032.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS source         TEXT,
  ADD COLUMN IF NOT EXISTS ingest_channel TEXT;

ALTER TABLE public.inbound_emails DROP CONSTRAINT IF EXISTS inbound_emails_source_check;
ALTER TABLE public.inbound_emails ADD CONSTRAINT inbound_emails_source_check
  CHECK (source IS NULL OR source IN ('postmark', 'gmail', 'zoho', 'bot'));

ALTER TABLE public.inbound_emails DROP CONSTRAINT IF EXISTS inbound_emails_ingest_channel_check;
ALTER TABLE public.inbound_emails ADD CONSTRAINT inbound_emails_ingest_channel_check
  CHECK (ingest_channel IS NULL OR
         ingest_channel IN ('postmark_webhook', 'mailbox_poll', 'bot_ingest', 'manual'));

-- ── Derive provenance for writers that don't state it ───────────────────────
-- auth.uid() is NULL for the service role (every Edge Function) and set for a
-- browser session, which is what separates a Postmark delivery from a paste.
CREATE OR REPLACE FUNCTION public.derive_inbound_email_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ingest_channel IS NULL THEN
    NEW.ingest_channel := CASE
      WHEN NEW.email_account_id IS NOT NULL THEN 'mailbox_poll'
      WHEN auth.uid() IS NOT NULL           THEN 'manual'
      ELSE 'postmark_webhook'
    END;
  END IF;

  IF NEW.source IS NULL THEN
    IF NEW.email_account_id IS NOT NULL THEN
      SELECT provider INTO NEW.source
        FROM public.email_accounts WHERE id = NEW.email_account_id;
    ELSIF NEW.ingest_channel = 'postmark_webhook' THEN
      NEW.source := 'postmark';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- Trigger-only: keep it off /rest/v1/rpc (same hygiene as 021/035).
REVOKE ALL ON FUNCTION public.derive_inbound_email_provenance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_inbound_emails_provenance ON public.inbound_emails;
CREATE TRIGGER trg_inbound_emails_provenance
  BEFORE INSERT ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.derive_inbound_email_provenance();

-- ── Backfill ────────────────────────────────────────────────────────────────
UPDATE public.inbound_emails ie
   SET ingest_channel = CASE
         WHEN ie.email_account_id IS NOT NULL      THEN 'mailbox_poll'
         WHEN coalesce(ie.raw_payload, '{}'::jsonb) ? 'MessageID' THEN 'postmark_webhook'
         ELSE 'manual'
       END
 WHERE ie.ingest_channel IS NULL;

UPDATE public.inbound_emails ie
   SET source = ea.provider
  FROM public.email_accounts ea
 WHERE ie.source IS NULL AND ie.email_account_id = ea.id;

UPDATE public.inbound_emails
   SET source = 'postmark'
 WHERE source IS NULL AND ingest_channel = 'postmark_webhook';

-- botIngest's per-minute ceiling counts recent rows on its own channel.
CREATE INDEX IF NOT EXISTS idx_inbound_emails_channel_created
  ON public.inbound_emails (ingest_channel, created_at DESC);

COMMIT;

-- Verify:
--   SELECT ingest_channel, source, count(*) FROM public.inbound_emails GROUP BY 1, 2;
--   -- expect no NULL ingest_channel rows
