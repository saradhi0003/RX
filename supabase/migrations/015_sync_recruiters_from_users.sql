-- ═══════════════════════════════════════════════════════════════════════════
-- 015_sync_recruiters_from_users.sql
--   Fix 23503 on submissions_recruiter_id_fkey (2026-07-06).
--
--   The UI's "Assigned Recruiter" picker lists app users (user_profiles) and
--   defaults to the signed-in user's id, but submissions.recruiter_id (and
--   timesheets/leave_requests etc.) reference the separate `recruiters` table,
--   which had 0 rows → every submission save with an assignee failed.
--
--   Model decision: app users ARE recruiters. Keep the recruiters entity, but
--   guarantee every user_profile has a recruiters row with the SAME id, seeded
--   now and maintained by trigger on future signups.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Seed: one recruiters row per existing user (id = user_profiles.id).
INSERT INTO recruiters (id, full_name, email, status)
SELECT p.id, coalesce(p.full_name, p.email), p.email, 'active'
FROM user_profiles p
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email     = EXCLUDED.email;

-- 2. Keep in sync: new/updated profiles upsert their recruiters twin.
CREATE OR REPLACE FUNCTION sync_recruiter_from_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO recruiters (id, full_name, email, status)
  VALUES (NEW.id, coalesce(NEW.full_name, NEW.email), NEW.email, 'active')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_recruiter ON user_profiles;
CREATE TRIGGER trg_profiles_sync_recruiter
  AFTER INSERT OR UPDATE OF full_name, email ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_recruiter_from_profile();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT (SELECT count(*) FROM user_profiles) AS profiles,
       (SELECT count(*) FROM recruiters)    AS recruiters;
