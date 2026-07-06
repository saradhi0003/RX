-- ============================================================================
-- 004_enterprise.sql — Enterprise improvements
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- ── 1. LLM cost-tracking table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS llm_usage (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider         TEXT NOT NULL,           -- openai | anthropic | ollama
  model            TEXT NOT NULL,
  prompt_tokens    INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd         NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms       INTEGER NOT NULL DEFAULT 0,
  task             TEXT NOT NULL DEFAULT 'unknown',  -- caller hint, e.g. "ats_score"
  user_email       TEXT,
  session_id       TEXT
);

-- RLS: admin can read all, authenticated users can insert their own
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_usage_insert" ON llm_usage
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "llm_usage_read_admin" ON llm_usage
  FOR SELECT TO authenticated
  USING (auth_is_admin());

-- Fast aggregation indexes (cost dashboard queries)
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider   ON llm_usage (provider);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_task       ON llm_usage (task);


-- ── 2. Full-text search indexes ────────────────────────────────────────────

-- array_to_string() is only STABLE, but generated columns require IMMUTABLE
-- expressions (42P17). Wrap it — safe because text[] → text joining is
-- deterministic for our use.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
RETURNS text LANGUAGE sql IMMUTABLE AS
$fn$ SELECT array_to_string($1, $2) $fn$;

-- candidates: search across name, email, title, skills, location, summary
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(full_name,  '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email,      '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title,      '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location,   '')), 'C') ||
    setweight(to_tsvector('english', coalesce(summary,    '')), 'D') ||
    setweight(to_tsvector('english', coalesce(immutable_array_to_string(skills, ' '), '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_candidates_fts ON candidates USING GIN (fts);

-- Additional GIN index on skills array for exact/overlap queries
CREATE INDEX IF NOT EXISTS idx_candidates_skills ON candidates USING GIN (skills);

-- jobs: search across title, description, skills_required, company_name, location
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,        '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location,     '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description,  '')), 'D') ||
    setweight(to_tsvector('english', coalesce(immutable_array_to_string(skills_required, ' '), '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_fts           ON jobs USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_jobs_skills        ON jobs USING GIN (skills_required);

-- companies: search name, industry, location, description
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name,        '')), 'A') ||
    setweight(to_tsvector('english', coalesce(industry,    '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location,    '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_companies_fts ON companies USING GIN (fts);


-- ── 3. Audit log triggers ──────────────────────────────────────────────────

-- Generic function that logs any INSERT/UPDATE/DELETE to audit_logs
CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Try to get the current user's email from user_profiles
  BEGIN
    SELECT email INTO v_user_email
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (
      coalesce(v_user_email, 'system'),
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD),
      NULL
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (
      coalesce(v_user_email, 'system'),
      'update',
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (
      coalesce(v_user_email, 'system'),
      'create',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop existing triggers if re-running
DROP TRIGGER IF EXISTS audit_candidates  ON candidates;
DROP TRIGGER IF EXISTS audit_jobs        ON jobs;
DROP TRIGGER IF EXISTS audit_companies   ON companies;
DROP TRIGGER IF EXISTS audit_submissions ON submissions;
DROP TRIGGER IF EXISTS audit_applications ON applications;
DROP TRIGGER IF EXISTS audit_tasks       ON tasks;

-- Attach trigger to core tables
CREATE TRIGGER audit_candidates
  AFTER INSERT OR UPDATE OR DELETE ON candidates
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

CREATE TRIGGER audit_jobs
  AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

CREATE TRIGGER audit_submissions
  AFTER INSERT OR UPDATE OR DELETE ON submissions
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

CREATE TRIGGER audit_applications
  AFTER INSERT OR UPDATE OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();

CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_entity_change();


-- ── 4. Performance indexes (bonus) ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_candidates_status      ON candidates (status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at  ON candidates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status            ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at        ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to      ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user        ON audit_logs (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);


-- ── Helper: search_candidates(query text) ──────────────────────────────────
-- Call from frontend via supabase.rpc('search_candidates', { query: 'react developer' })
CREATE OR REPLACE FUNCTION search_candidates(query TEXT)
RETURNS SETOF candidates LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT *
  FROM candidates
  WHERE fts @@ websearch_to_tsquery('english', query)
  ORDER BY ts_rank(fts, websearch_to_tsquery('english', query)) DESC
  LIMIT 50;
$$;

-- ── Helper: search_jobs(query text) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION search_jobs(query TEXT)
RETURNS SETOF jobs LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT *
  FROM jobs
  WHERE fts @@ websearch_to_tsquery('english', query)
  ORDER BY ts_rank(fts, websearch_to_tsquery('english', query)) DESC
  LIMIT 50;
$$;

-- ── Summary view for LLM cost dashboard ────────────────────────────────────
CREATE OR REPLACE VIEW llm_usage_summary AS
SELECT
  date_trunc('day', created_at)  AS day,
  provider,
  model,
  COUNT(*)                        AS call_count,
  SUM(prompt_tokens)              AS total_prompt_tokens,
  SUM(completion_tokens)          AS total_completion_tokens,
  SUM(cost_usd)                   AS total_cost_usd,
  AVG(latency_ms)                 AS avg_latency_ms
FROM llm_usage
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_cost_usd DESC;
