-- ============================================================================
-- 007_fix_legacy_unique.sql
--   PASTE INTO Supabase Dashboard → SQL Editor → Run
--
-- Why:
--   Migration 006 created PARTIAL unique indexes on legacy_id
--   (... WHERE legacy_id IS NOT NULL). PostgREST's upsert  onConflict='legacy_id'
--   cannot infer a partial index — it needs a plain unique index/constraint.
--
--   Postgres still treats NULLs as distinct in a plain unique index, so app-
--   created rows with NULL legacy_id remain unaffected.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS uq_companies_legacy_id;
DROP INDEX IF EXISTS uq_candidates_legacy_id;
DROP INDEX IF EXISTS uq_jobs_legacy_id;
DROP INDEX IF EXISTS uq_consultants_legacy_id;
DROP INDEX IF EXISTS uq_submissions_legacy_id;
DROP INDEX IF EXISTS uq_tasks_legacy_id;
DROP INDEX IF EXISTS uq_timesheets_legacy_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_legacy_id   ON companies(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_legacy_id  ON candidates(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_legacy_id        ON jobs(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultants_legacy_id ON consultants(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_legacy_id ON submissions(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_legacy_id       ON tasks(legacy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheets_legacy_id  ON timesheets(legacy_id);

COMMIT;

-- Verify:
SELECT indexrelid::regclass AS index_name, indrelid::regclass AS table_name
FROM pg_index
WHERE indrelid::regclass::text IN
      ('companies','candidates','jobs','consultants',
       'submissions','tasks','timesheets')
  AND indisunique
ORDER BY 2, 1;
