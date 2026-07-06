-- ═══════════════════════════════════════════════════════════════════════════
-- 016_signup_approval.sql — Admin approval gate for new signups (2026-07-06)
--
-- AccessControl UI, Layout gate, and AccessBlocker already enforce
-- user_profiles.status / is_locked — but the columns never existed (drift).
-- Add them: new profiles default to 'invited' (pending admin approval);
-- admins flip to 'active' in Access Control. Existing users backfilled active.
-- Server-side RLS enforcement of approval lands with the 012 policy swap.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited'
  CHECK (status IN ('invited','active','inactive'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Everyone who already has an account predates the approval gate → active.
UPDATE user_profiles SET status = 'active' WHERE status IS NULL OR status = 'invited';

COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT email, status, is_locked FROM user_profiles ORDER BY email;
