-- ═══════════════════════════════════════════════════════════════════════════
-- 012_multitenancy.sql  —  P0-1: Multi-tenant data isolation (workspace scoping)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY
--   Every RLS policy currently gates on `auth.uid() IS NOT NULL`, so any
--   authenticated user sees EVERY tenant's rows. For multi-tenant SaaS this is a
--   data-isolation defect. This migration scopes all tenant tables by a
--   `workspace_id` and rewrites the policies to `workspace_id = auth_workspace_id()`.
--
-- STRATEGY (additive-first, single transaction, idempotent)
--   1. workspaces table + one default workspace (holds all existing data)
--   2. auth_workspace_id() + stamp_workspace_id() helpers
--   3. convert the 3 pre-existing TEXT workspace_id columns -> UUID FK
--   4. add workspace_id to every tenant table, backfill to default, NOT NULL,
--      index, and a BEFORE INSERT trigger that auto-stamps it
--      (=> src/lib/entityFactory.js needs no change)
--   5. per-workspace uniqueness for app_settings.key
--   6. swap RLS policies to workspace-scoped (the only hard cutover; done last)
--
-- ⚠ MUST be applied to a PREVIEW Supabase and verified (two workspaces can't see
--   each other) BEFORE prod. See ARCHITECTURE.md §24 / the plan's Verification.
--
-- ⚠ EDGE FUNCTIONS / BOTS use the service-role key, which BYPASSES RLS and does
--   NOT populate auth_workspace_id(). Any service-role INSERT into a tenant table
--   must set workspace_id explicitly, or it will fail the NOT NULL check.
--   (Tracked as the Edge-Function audit step of P0-1.)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- The single workspace that owns all pre-existing (~6,920) rows.
-- Fixed UUID so the backfill and any manual checks are reproducible.
--   default = 00000000-0000-0000-0000-000000000001

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. workspaces
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

INSERT INTO workspaces (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helpers  (mirror the existing auth_is_admin() pattern)
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns the calling user's workspace. SECURITY DEFINER so the policy can read
-- user_profiles regardless of that table's own RLS. STABLE: one value per stmt.
CREATE OR REPLACE FUNCTION auth_workspace_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT workspace_id FROM user_profiles WHERE id = auth.uid();
$$;

-- BEFORE INSERT trigger fn: stamp the caller's workspace when not supplied.
CREATE OR REPLACE FUNCTION stamp_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := auth_workspace_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Convert the 3 pre-existing TEXT workspace_id columns -> UUID FK
--    (user_profiles, channel_connections, whatsapp_registrations)
--    Existing values are free-text names / nulls → all map to the default ws.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_profiles','channel_connections','whatsapp_registrations'] LOOP
    -- only convert if the column is currently non-UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'workspace_id' AND data_type <> 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN ws_uuid UUID', t);
      EXECUTE format('UPDATE %I SET ws_uuid = %L', t, '00000000-0000-0000-0000-000000000001');
      EXECUTE format('ALTER TABLE %I DROP COLUMN workspace_id', t);
      EXECUTE format('ALTER TABLE %I RENAME COLUMN ws_uuid TO workspace_id', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Add workspace_id to every tenant table; backfill; NOT NULL; index; trigger.
--    user_profiles is handled separately (its ws is set explicitly at signup, so
--    it gets NO stamp trigger — at signup auth_workspace_id() is still null).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    -- standard tenant data
    'candidates','companies','jobs','recruiters','applications','submissions',
    'resumes','tasks','consultants','playbooks','automation_rules','email_templates',
    'invoices','expenses','timesheets','leave_requests','ai_recruiter_runs',
    'candidate_match_results','email_drafts','sent_emails','followup_schedules',
    'recruiter_activities','inbound_emails','inbound_channel_messages',
    'bookings','video_call_recordings','llm_usage',
    -- admin-gated tenant data
    'channel_connections','whatsapp_registrations','ai_recruiter_settings',
    'app_settings','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- add (no-op for channel_connections/whatsapp_registrations, already UUID)
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)', t);
    -- backfill existing rows to the default workspace
    EXECUTE format(
      'UPDATE %I SET workspace_id = %L WHERE workspace_id IS NULL',
      t, '00000000-0000-0000-0000-000000000001');
    -- enforce + index
    EXECUTE format('ALTER TABLE %I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON %I(workspace_id)', t, t);
    -- auto-stamp on insert
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_stamp_ws ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_stamp_ws BEFORE INSERT ON %I
         FOR EACH ROW EXECUTE FUNCTION stamp_workspace_id()', t, t);
  END LOOP;
END $$;

-- user_profiles: backfill done in step 3; add FK + index (no stamp trigger).
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
ALTER TABLE user_profiles ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_workspace ON user_profiles(workspace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Per-workspace uniqueness for app_settings (was global UNIQUE(key)).
--    Each workspace needs its own "workspace_name", "workspace_timezone", etc.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_settings_ws_key
  ON app_settings(workspace_id, key);

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. RLS policy swap  (HARD CUTOVER — done last, after backfill above)
-- ═════════════════════════════════════════════════════════════════════════════

-- 6a. Standard tenant tables: single workspace-scoped policy.
DO $$
DECLARE
  t TEXT;
  std_tables TEXT[] := ARRAY[
    'candidates','companies','jobs','recruiters','applications','submissions',
    'resumes','tasks','consultants','playbooks','automation_rules','email_templates',
    'invoices','expenses','timesheets','leave_requests','ai_recruiter_runs',
    'candidate_match_results','email_drafts','sent_emails','followup_schedules',
    'recruiter_activities','inbound_emails','inbound_channel_messages',
    'bookings','video_call_recordings'
  ];
BEGIN
  FOREACH t IN ARRAY std_tables LOOP
    -- drop the old auth-only policies (names vary across migrations)
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "bookings_authenticated" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "vcr_authenticated" ON %I', t);
    -- new workspace-scoped policy
    EXECUTE format(
      'CREATE POLICY "workspace_all" ON %I
         USING (workspace_id = auth_workspace_id())
         WITH CHECK (workspace_id = auth_workspace_id())', t);
  END LOOP;
END $$;

-- 6b. Admin-gated tenant tables: same workspace AND admin.
DO $$
DECLARE
  t TEXT;
  admin_tables TEXT[] := ARRAY['channel_connections','whatsapp_registrations'];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_only" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "workspace_admin" ON %I
         USING (workspace_id = auth_workspace_id() AND auth_is_admin())
         WITH CHECK (workspace_id = auth_workspace_id() AND auth_is_admin())', t);
  END LOOP;
END $$;

-- 6c. ai_recruiter_settings: read within workspace, write admin-in-workspace.
DROP POLICY IF EXISTS "admin_only" ON ai_recruiter_settings;
CREATE POLICY "ws_read" ON ai_recruiter_settings
  FOR SELECT USING (workspace_id = auth_workspace_id());
CREATE POLICY "ws_admin_write" ON ai_recruiter_settings
  FOR ALL USING (workspace_id = auth_workspace_id() AND auth_is_admin())
          WITH CHECK (workspace_id = auth_workspace_id() AND auth_is_admin());

-- 6d. app_settings: read within workspace, write admin-in-workspace.
DROP POLICY IF EXISTS "admin_only_write" ON app_settings;
DROP POLICY IF EXISTS "admin_only_write_mutation" ON app_settings;
CREATE POLICY "ws_read" ON app_settings
  FOR SELECT USING (workspace_id = auth_workspace_id());
CREATE POLICY "ws_admin_write" ON app_settings
  FOR ALL USING (workspace_id = auth_workspace_id() AND auth_is_admin())
          WITH CHECK (workspace_id = auth_workspace_id() AND auth_is_admin());

-- 6e. audit_logs: insert + read scoped to workspace (read still admin-only).
DROP POLICY IF EXISTS "auth_insert" ON audit_logs;
DROP POLICY IF EXISTS "admin_read"  ON audit_logs;
CREATE POLICY "ws_insert" ON audit_logs
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
CREATE POLICY "ws_admin_read" ON audit_logs
  FOR SELECT USING (workspace_id = auth_workspace_id() AND auth_is_admin());

-- 6f. llm_usage: insert within workspace, read admin-in-workspace.
DROP POLICY IF EXISTS "llm_usage_insert"     ON llm_usage;
DROP POLICY IF EXISTS "llm_usage_read_admin" ON llm_usage;
CREATE POLICY "ws_insert" ON llm_usage
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
CREATE POLICY "ws_admin_read" ON llm_usage
  FOR SELECT USING (workspace_id = auth_workspace_id() AND auth_is_admin());

-- 6g. user_profiles: own profile, OR an admin within the same workspace.
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (id = auth.uid()
                    OR (auth_is_admin() AND workspace_id = auth_workspace_id()));
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid()
                    OR (auth_is_admin() AND workspace_id = auth_workspace_id()));
CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid()
                    OR (auth_is_admin() AND workspace_id = auth_workspace_id()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. workspaces table policies.
--    - SELECT: a user sees only their own workspace.
--    - INSERT: any authenticated user may create a workspace (this is the signup
--      action; the brand-new user has no profile/workspace yet). The client
--      supplies the id so it never needs to read the row back through RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "own_workspace" ON workspaces
  FOR SELECT USING (id = auth_workspace_id());
CREATE POLICY "create_workspace" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- updated_at trigger for workspaces (mirror existing set_updated_at()).
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: blog_posts and form_submissions are intentionally left as public-facing
-- (published posts world-readable; anonymous careers-form inserts). They are NOT
-- workspace-scoped here; revisit if marketing/careers go multi-tenant.

COMMIT;
