-- ============================================================================
-- 005_import_prep.sql — Schema additions for Base44 → Supabase data import
-- Adds legacy_id (preserves original Base44 ID) and raw_data (preserves full
-- original row as JSONB so no field is lost) to every importable table.
-- Run this BEFORE running scripts/import-csv-data.js
-- ============================================================================

-- ── companies ──
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legacy_id  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS raw_data   JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacts   JSONB;
CREATE INDEX IF NOT EXISTS idx_companies_legacy_id ON companies(legacy_id);

-- ── candidates ──
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legacy_id     TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS raw_data      JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name     TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_authorization TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bench_match_score  NUMERIC(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS screening_score    NUMERIC(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS screening_details  JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bench_score_details JSONB;
CREATE INDEX IF NOT EXISTS idx_candidates_legacy_id ON candidates(legacy_id);

-- ── jobs ──
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS legacy_id            TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS raw_data             JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS legacy_company_id    TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preferred_skills     TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visa_restrictions    TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hiring_manager       TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_type        TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate                 TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requester_email      TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requester_name       TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_preference  TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS remote_type          TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_legacy_id ON jobs(legacy_id);

-- ── consultants ──
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS legacy_id    TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS raw_data     JSONB;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS first_name   TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS last_name    TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS company      TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS specialization TEXT[];
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_min     NUMERIC(10,2);
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_max     NUMERIC(10,2);
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_type    TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rating       NUMERIC(3,1);
CREATE INDEX IF NOT EXISTS idx_consultants_legacy_id ON consultants(legacy_id);

-- ── submissions ──
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_id           TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS raw_data            JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_candidate_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_job_id       TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_company_id   TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_date      DATE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_date_text TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS interview_dates     JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS comments            TEXT;
CREATE INDEX IF NOT EXISTS idx_submissions_legacy_id ON submissions(legacy_id);

-- ── tasks ──
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legacy_id        TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS raw_data         JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity   TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_id       TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legacy_related_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_legacy_id ON tasks(legacy_id);

-- ── timesheets ──
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS legacy_id      TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS raw_data       JSONB;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS legacy_job_id  TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS work_date      DATE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS user_email     TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS notes          TEXT;
CREATE INDEX IF NOT EXISTS idx_timesheets_legacy_id ON timesheets(legacy_id);

-- ── roles (stored in app_settings as a JSONB row) ──
-- No schema change needed; roles import inserts into app_settings
-- with key='roles_definitions'.

-- Done. Now run: cd recruiter-x1 && npm run import:data
