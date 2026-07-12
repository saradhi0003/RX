-- 017_agents.sql — AI Agents persistence (replaces the mock data in AIAgents.jsx)
--
-- APPLY GATE (Supabase currently paused):
--   1. Restore/unpause the Supabase project (or use a preview project).
--   2. Run this file in the SQL editor (or `supabase db push`) AFTER 016.
--   3. Only then merge the frontend that reads these tables (branch feat/ai-core).
--
-- workspace_id is present but NULLABLE — migration 012 (multi-tenancy, on branch
-- feat/multi-tenancy-p0-1) will backfill + bind RLS to it. Until then RLS follows
-- the current main pattern (authenticated-only).

CREATE TABLE IF NOT EXISTS agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID,                       -- bound by migration 012's successor
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'manual'
                CHECK (type IN ('entity_trigger', 'scheduled', 'manual')),
  trigger_config JSONB DEFAULT '{}'::jsonb, -- e.g. { entity, event } | { cron }
  actions       JSONB DEFAULT '[]'::jsonb,  -- ordered action list from AIAgentBuilder
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  run_count     INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents (enabled);

CREATE TABLE IF NOT EXISTS agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id  UUID,                       -- bound by migration 012's successor
  status        TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'success', 'failed')),
  context       JSONB,                      -- trigger payload / inputs
  result        JSONB,                      -- step outputs (ReAct steps later)
  error         TEXT,
  tokens_used   INT,
  cost_usd      DECIMAL(10,6),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs (agent_id, started_at DESC);

-- RLS: current main pattern (authenticated). 012 rewrites to workspace scoping.
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_all_authenticated" ON agents
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "agent_runs_all_authenticated" ON agent_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
