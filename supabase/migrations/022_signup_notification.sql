-- ═══════════════════════════════════════════════════════════════════════════
-- 022_signup_notification.sql — track whether the admin was told about a signup
--
-- The approval gate (020) locks new signups out until an admin flips them to
-- 'active' in Access Control — but nothing tells the admin a request is
-- waiting, so a new user can sit blocked indefinitely.
--
-- notified_at is stamped ONLY on a successful send, so a failed or skipped
-- notification retries on the user's next sign-in. Notification is strictly
-- best-effort: approval never depends on email, and the Access Control list is
-- always the source of truth.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.notified_at IS
  'When the admin was emailed about this pending access request. NULL = not yet '
  'notified (or the last attempt failed). Stamped only on a successful send.';

-- Existing users predate the notification flow; nothing to send for them.
UPDATE user_profiles SET notified_at = NOW()
 WHERE notified_at IS NULL AND status <> 'invited';

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT status, count(*) AS users, count(notified_at) AS notified
  FROM user_profiles GROUP BY status ORDER BY status;
