-- ═══════════════════════════════════════════════════════════════════════════
-- 013_fix_audit_trigger_and_schema_sync.sql
--   HOTFIX for two save-breaking issues found in prod (2026-07-06):
--
--   1. audit_entity_change() cast NEW.id/OLD.id to TEXT, but
--      audit_logs.entity_id is UUID → 42804 on EVERY insert/update/delete of
--      candidates, jobs, companies, submissions, applications, tasks
--      ("no save works", Kanban drag snaps back). 004 is fixed in-repo; this
--      re-applies the corrected function for databases that ran the old 004.
--
--   2. submissions.notes did not exist but SubmissionForm/Details/FollowUp all
--      read+write it → PGRST204 on submission saves. Add the column and
--      backfill from submission_notes for continuity.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Corrected audit trigger (entity_id stays uuid) ───────────────────────
CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  BEGIN
    SELECT email INTO v_user_email FROM user_profiles WHERE id = auth.uid() LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (coalesce(v_user_email, 'system'), 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD), NULL);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (coalesce(v_user_email, 'system'), 'update', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
    VALUES (coalesce(v_user_email, 'system'), 'create', TG_TABLE_NAME, NEW.id, NULL, row_to_json(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ── 2. submissions.notes (app-wide field; PGRST204 without it) ──────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE submissions SET notes = submission_notes WHERE notes IS NULL AND submission_notes IS NOT NULL;

COMMIT;

-- PostgREST caches the schema; force a reload so new columns are visible
-- immediately (otherwise saves keep failing until the next natural reload).
NOTIFY pgrst, 'reload schema';
