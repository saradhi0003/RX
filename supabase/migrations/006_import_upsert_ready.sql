-- ============================================================================
-- 006_import_upsert_ready.sql
--   PASTE THIS ENTIRE FILE INTO  Supabase Dashboard → SQL Editor → Run
--
-- Purpose:
--   (A) Re-applies every column/index from 005_import_prep.sql idempotently,
--       so it is safe to run even if 005 was already applied.
--   (B) Adds UNIQUE constraints on `legacy_id` for every import-target table,
--       which is required by  INSERT … ON CONFLICT (legacy_id)  upsert in
--       scripts/import-csv-data.js.
--   (C) Leaves data alone — nothing is deleted, no rows are touched.
--
-- After this runs successfully:
--      cd recruiter-x1 && npm run import:data
-- ============================================================================

BEGIN;

-- ── companies ───────────────────────────────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legacy_id      TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS raw_data       JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacts       JSONB;

-- ── candidates ──────────────────────────────────────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legacy_id           TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS raw_data            JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name          TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name           TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_authorization  TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bench_match_score   NUMERIC(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS screening_score     NUMERIC(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS screening_details   JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bench_score_details JSONB;

-- ── jobs ────────────────────────────────────────────────────────────────────
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

-- ── consultants ─────────────────────────────────────────────────────────────
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS legacy_id      TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS raw_data       JSONB;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS company        TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS specialization TEXT[];
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_min       NUMERIC(10,2);
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_max       NUMERIC(10,2);
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rate_type      TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS portfolio_url  TEXT;
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS rating         NUMERIC(3,1);

-- ── submissions ─────────────────────────────────────────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_id           TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS raw_data            JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_candidate_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_job_id       TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS legacy_company_id   TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_date      DATE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_date_text TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS interview_dates     JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS comments            TEXT;

-- ── tasks ───────────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legacy_id         TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS raw_data          JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity    TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_id        TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legacy_related_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_notes  TEXT;

-- ── timesheets ──────────────────────────────────────────────────────────────
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS legacy_id     TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS raw_data      JSONB;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS legacy_job_id TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS work_date     DATE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS user_email    TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS notes         TEXT;

-- ── UNIQUE indexes on legacy_id ─────────────────────────────────────────────
-- Required for  INSERT … ON CONFLICT (legacy_id) DO UPDATE  upsert.
-- WHERE clause keeps the constraint partial (legacy_id IS NOT NULL) so rows
-- created in the app without a legacy_id (e.g. brand-new candidates) are not
-- forced to share NULL — Postgres treats NULLs as distinct in unique indexes,
-- but a partial index makes the intent explicit.

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_legacy_id
  ON companies(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_legacy_id
  ON candidates(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_legacy_id
  ON jobs(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_consultants_legacy_id
  ON consultants(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_legacy_id
  ON submissions(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_legacy_id
  ON tasks(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheets_legacy_id
  ON timesheets(legacy_id) WHERE legacy_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY — run this after the COMMIT to confirm everything landed.
-- Expected: 7 rows, all with has_legacy_id = t and has_raw_data = t (or 1 for
-- timesheets/tasks where raw_data is JSONB).
-- ============================================================================
SELECT
  table_name,
  bool_or(column_name = 'legacy_id') AS has_legacy_id,
  bool_or(column_name = 'raw_data')  AS has_raw_data
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('companies','candidates','jobs','consultants',
                     'submissions','tasks','timesheets')
GROUP BY table_name
ORDER BY table_name;
