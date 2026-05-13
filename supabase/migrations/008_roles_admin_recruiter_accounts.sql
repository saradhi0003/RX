-- ============================================================================
-- 008_roles_admin_recruiter_accounts.sql
--   PASTE INTO Supabase Dashboard → SQL Editor → Run
--
-- Migrates user_profiles.role from { admin, member, viewer }
-- to               { admin, recruiter, accounts }.
--   • Existing 'member'  → 'recruiter'  (most common case)
--   • Existing 'viewer'  → 'recruiter'  (no read-only role in new model;
--                                        downgrade to recruiter, then admin
--                                        can adjust per-user permissions)
--   • Existing 'admin'   stays 'admin'.
--
-- Plus: seeds the canonical role-permission JSON under
-- app_settings.key = 'roles_definitions' so PermissionsContext can read it.
-- ============================================================================

BEGIN;

-- 1. Drop the old CHECK constraint (Postgres names it user_profiles_role_check)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 2. Migrate existing values
UPDATE user_profiles SET role = 'recruiter' WHERE role IN ('member','viewer');
UPDATE user_profiles SET role = 'recruiter' WHERE role IS NULL;

-- 3. Apply the new CHECK constraint
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','recruiter','accounts'));

-- 4. Default new sign-ups to 'recruiter'
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'recruiter';

-- 5. Seed roles_definitions in app_settings (used by PermissionsContext).
--    Each role lists every entity with its CRUD + scope ("own" vs "all").
--    Admin gets implicit "all everywhere" in code, so its row here is for
--    completeness / display only.
INSERT INTO app_settings (key, value, description, is_public)
VALUES (
  'roles_definitions',
  jsonb_build_array(
    jsonb_build_object(
      'name', 'admin',
      'description', 'Full access to every page, every record, every setting.',
      'permissions', jsonb_build_object(
        'Candidate',   jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Job',         jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Company',     jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Submission',  jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Task',        jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Consultant',  jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Invoice',     jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Expense',     jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Timesheet',   jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'LeaveRequest',jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'User',        jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Role',        jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'AutomationRule', jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Playbook',    jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'EmailTemplate', jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all')
      )
    ),
    jsonb_build_object(
      'name', 'recruiter',
      'description', 'Standard recruiting role. Owns candidates, jobs, submissions, tasks. Read-only on accounting.',
      'permissions', jsonb_build_object(
        'Candidate',   jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'Job',         jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'Company',     jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'Submission',  jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'Task',        jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'Consultant',  jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'Invoice',     jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Expense',     jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'Timesheet',   jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'LeaveRequest',jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'User',        jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Role',        jsonb_build_object('view',false,'create',false,'update',false,'delete',false,'scope','own'),
        'AutomationRule', jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Playbook',    jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'EmailTemplate', jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all')
      )
    ),
    jsonb_build_object(
      'name', 'accounts',
      'description', 'Accounting role. Full access to invoices, expenses, timesheets. Read-only on recruiting.',
      'permissions', jsonb_build_object(
        'Candidate',   jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Job',         jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Company',     jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'Submission',  jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Task',        jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','own'),
        'Consultant',  jsonb_build_object('view',true,'create',false,'update',true,'delete',false,'scope','all'),
        'Invoice',     jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Expense',     jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'Timesheet',   jsonb_build_object('view',true,'create',true,'update',true,'delete',true,'scope','all'),
        'LeaveRequest',jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all'),
        'User',        jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'Role',        jsonb_build_object('view',false,'create',false,'update',false,'delete',false,'scope','own'),
        'AutomationRule', jsonb_build_object('view',false,'create',false,'update',false,'delete',false,'scope','own'),
        'Playbook',    jsonb_build_object('view',true,'create',false,'update',false,'delete',false,'scope','all'),
        'EmailTemplate', jsonb_build_object('view',true,'create',true,'update',true,'delete',false,'scope','all')
      )
    )
  ),
  'Per-role CRUD + scope permission matrix. Loaded by PermissionsContext.',
  false
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

COMMIT;

-- Verification:
SELECT role, count(*) AS users FROM user_profiles GROUP BY role ORDER BY role;
SELECT key, jsonb_array_length(value) AS role_count FROM app_settings WHERE key = 'roles_definitions';
