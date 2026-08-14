-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 032: Email intake — connected Gmail/Zoho accounts + classification
-- columns on inbound_emails so the LLM pipeline can route mail to records.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── email_accounts ──────────────────────────────────────────────────────────
-- One row per connected mailbox. OAuth tokens live here, server-side only:
-- Edge Functions use the service role (bypasses RLS); browsers get column
-- grants on the non-secret columns below and nothing else. Never widen the
-- authenticated grant to cover access_token / refresh_token.
CREATE TABLE IF NOT EXISTS email_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID,
  provider         TEXT NOT NULL CHECK (provider IN ('gmail', 'zoho')),
  email_address    TEXT NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  -- Incremental polling cursor: Gmail historyId / Zoho last-message timestamp.
  history_cursor   TEXT,
  -- Provider-side account handle (Zoho accountId); Gmail leaves this null.
  external_account_id TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at   TIMESTAMPTZ,
  last_error       TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, email_address)
);

CREATE TRIGGER trg_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- Admins see account status for their workspace; writes go through the
-- service role (OAuth callback + poller), which bypasses RLS.
CREATE POLICY "email_accounts_admin_workspace" ON email_accounts
  FOR ALL TO authenticated
  USING (workspace_id = auth_workspace_id() AND auth_is_admin())
  WITH CHECK (workspace_id = auth_workspace_id() AND auth_is_admin());

-- Column-level tightening: even with the policy above, authenticated sessions
-- may only SELECT the non-secret columns.
REVOKE SELECT ON email_accounts FROM authenticated;
GRANT SELECT (id, workspace_id, provider, email_address, is_active,
              last_polled_at, last_error, created_at, updated_at)
  ON email_accounts TO authenticated;

-- ── inbound_emails: classification results + account link ───────────────────
ALTER TABLE inbound_emails
  ADD COLUMN IF NOT EXISTS classification            TEXT,
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS email_account_id          UUID REFERENCES email_accounts(id);

-- ── approval_items: new type for low-confidence email intake ────────────────
ALTER TABLE approval_items DROP CONSTRAINT IF EXISTS approval_items_type_check;
ALTER TABLE approval_items ADD CONSTRAINT approval_items_type_check
  CHECK (type IN ('email_draft', 'agent_action', 'automation_step', 'bulk_outreach', 'email_intake'));

-- ── Scheduling ──────────────────────────────────────────────────────────────
-- pollEmailInboxes is invoked the same way scheduledFollowupRun is: a
-- Supabase scheduled trigger (Dashboard → Edge Functions → Schedules) hitting
-- the function every 5 minutes with the x-cron-secret header. It is not
-- created here because the CRON_SECRET value must not live in a migration.
