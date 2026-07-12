-- 018_approval_items.sql — generic human-approval gate (beyond email drafts)
--
-- APPLY GATE (Supabase currently paused):
--   1. Restore/unpause the Supabase project (or use a preview project).
--   2. Run this file in the SQL editor AFTER 017_agents.sql.
--   3. Only then merge the frontend that reads this table (branch feat/ai-core).
--
-- Approval Queue today reviews email_drafts only. This table lets any risky
-- automated action (agent step, automation rule, bulk outreach) queue for a
-- human decision. email_drafts keeps its own flow; other sources insert here.
-- workspace_id nullable until multi-tenancy (012 successor) binds it.

CREATE TABLE IF NOT EXISTS approval_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  type            TEXT NOT NULL
                  CHECK (type IN ('email_draft', 'agent_action', 'automation_step', 'bulk_outreach')),
  risk_tier       TEXT NOT NULL DEFAULT 'medium'
                  CHECK (risk_tier IN ('low', 'medium', 'high')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  title           TEXT NOT NULL,               -- one-line "what is being asked"
  ai_confidence   DECIMAL(3,2),                -- 0.00–1.00
  action_payload  JSONB,                       -- what executes on approval
  diff_summary    TEXT,                        -- human-readable "what will change"
  source_id       UUID,                        -- agent_runs.id / automation id / …
  source_type     TEXT,
  owner_id        UUID REFERENCES auth.users(id),
  due_at          TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  decision        TEXT,
  decision_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_items_pending
  ON approval_items (status, due_at) WHERE status = 'pending';

ALTER TABLE approval_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_items_all_authenticated" ON approval_items
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
