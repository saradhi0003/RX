-- ─────────────────────────────────────────────────────────────────────────────
-- Demo Users Seed  (run once against your Supabase project)
-- Passwords are set via Supabase Auth; this script creates the profile rows.
--
-- To create the auth users, run in Supabase dashboard → SQL Editor:
--
--   SELECT supabase_auth.create_user('admin@recruiterx.demo',     'Demo@Admin123',     '{"full_name":"Admin Demo"}');
--   SELECT supabase_auth.create_user('recruiter@recruiterx.demo', 'Demo@Recruiter123', '{"full_name":"Recruiter Demo"}');
--   SELECT supabase_auth.create_user('viewer@recruiterx.demo',    'Demo@Viewer123',    '{"full_name":"Viewer Demo"}');
--
-- OR use the Supabase CLI:
--   supabase auth create-user --email admin@recruiterx.demo --password Demo@Admin123
--
-- This migration inserts the user_profiles rows for any auth users that
-- already match those emails (safe to run multiple times).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO user_profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  CASE u.email
    WHEN 'admin@recruiterx.demo'     THEN 'Admin Demo'
    WHEN 'recruiter@recruiterx.demo' THEN 'Recruiter Demo'
    WHEN 'viewer@recruiterx.demo'    THEN 'Viewer Demo'
  END,
  CASE u.email
    WHEN 'admin@recruiterx.demo'     THEN 'admin'
    WHEN 'recruiter@recruiterx.demo' THEN 'member'
    WHEN 'viewer@recruiterx.demo'    THEN 'viewer'
  END
FROM auth.users u
WHERE u.email IN (
  'admin@recruiterx.demo',
  'recruiter@recruiterx.demo',
  'viewer@recruiterx.demo'
)
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name;
