-- ═══════════════════════════════════════════════════════════════════════════
-- 020_approval_rls_enforcement.sql — make the admin-approval gate REAL
--
-- 016 added user_profiles.status / is_locked and the app enforces them in
-- React (Layout.jsx `isBlocked`, AccessBlocker.jsx). The database never did:
-- every data policy from 002 is `USING (auth.uid() IS NOT NULL)`, so a signup
-- sitting at status='invited' who confirms their email can read (and write)
-- every candidate, company, invoice and expense straight through PostgREST —
-- the UI never runs. 016 said this landed "with the 012 policy swap"; 012 is
-- still unapplied on another branch, so it never landed at all.
--
-- This migration compiles approval into the policies themselves:
--   1. auth_is_approved()      — the predicate (SECURITY DEFINER, pinned path)
--   2. auth_is_admin()         — hardened: a locked/inactive admin is not admin
--   3. user_profiles guard     — closes a privilege-escalation hole (below)
--   4. policy rewrite          — every data table now requires approval
--   5. storage.objects         — same gate on meeting-recordings
--
-- ⚠ The escalation hole (3): 002's `user_profiles_update` is
--   `USING (id = auth.uid() ...)` with no column restriction, so ANY user could
--   `UPDATE user_profiles SET status='active', role='admin' WHERE id=me` and
--   self-approve. Gating the data tables without this leaves the front door
--   open. RLS can't express column-level rules, so a BEFORE trigger pins the
--   privileged columns for non-admin callers.
--
-- NOTE ON UNAPPLIED MIGRATIONS: 017 (agents/agent_runs) and 018
-- (approval_items) are staged on feat/ai-core and may not exist yet; 012's
-- tables likewise. Every statement below is guarded with to_regclass(), so this
-- migration is safe to run before OR after them and is re-runnable.
--
-- SHARED-TENANT NOTE: Recruiter X is a shared-workspace CRM, not per-user rows.
-- The gate is approval ONLY — deliberately not `user_id = auth.uid()`, which
-- would hide every existing row from everyone. Per-tenant scoping is migration
-- 012's job (feat/multi-tenancy-p0-1) and composes with this.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE PREDICATE
--    SECURITY DEFINER so it can read user_profiles from inside user_profiles'
--    own policies without recursive policy evaluation. search_path is pinned —
--    an unpinned DEFINER function is a privilege-escalation vector.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_is_approved()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_locked, FALSE) = FALSE
  );
$$;

COMMENT ON FUNCTION auth_is_approved() IS
  'True when the caller has an approved, unlocked profile. The server-side twin '
  'of Layout.jsx isBlocked. Compiled into every data policy by migration 020.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HARDEN auth_is_admin()
--    002 checked role='admin' only, so a LOCKED or deactivated admin still
--    passed every admin_only policy. Approval is now a precondition of admin.
--    (Also adds the STABLE + pinned search_path that 002 omitted.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
      AND COALESCE(is_locked, FALSE) = FALSE
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CLOSE THE SELF-APPROVAL HOLE
--    user_profiles keeps its self-read/self-update policies (AuthContext must
--    read its own status to render AccessBlocker, and bootstraps its own row on
--    first login after email verification). What it must NOT be able to do is
--    set its own role/status/is_locked/workspace_id. A BEFORE trigger pins
--    those columns for everyone except an admin.
--
--    auth.uid() IS NULL means service_role or the SQL editor — left untouched
--    so Edge Functions and manual admin fixes still work.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guard_user_profile_privileges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth_is_admin() THEN
    RETURN NEW;                       -- service role, SQL editor, or an admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Self-bootstrap (AuthContext.jsx) may create a row, never a privileged one.
    NEW.role         := 'recruiter';
    NEW.status       := 'invited';
    NEW.is_locked    := FALSE;
    NEW.workspace_id := NULL;
  ELSE
    -- Self-service edits (name, phone, title, avatar, preferences) are fine;
    -- the privileged columns snap back to their stored values.
    NEW.id           := OLD.id;
    NEW.role         := OLD.role;
    NEW.status       := OLD.status;
    NEW.is_locked    := OLD.is_locked;
    NEW.workspace_id := OLD.workspace_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_privileges ON user_profiles;
CREATE TRIGGER trg_guard_user_profile_privileges
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION guard_user_profile_privileges();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THE ACTUAL LOCKOUT — approval baked into every data policy
--
--    4a. The 24 tables carrying 002's "authenticated_all" policy. Same policy
--        name on every one, so one loop covers them. to_regclass() skips any
--        table that doesn't exist in this database yet.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'candidates', 'companies', 'jobs', 'recruiters', 'applications',
    'submissions', 'resumes', 'tasks', 'consultants', 'playbooks',
    'automation_rules', 'email_templates', 'invoices', 'expenses',
    'timesheets', 'leave_requests', 'inbound_emails',
    'inbound_channel_messages', 'ai_recruiter_runs', 'candidate_match_results',
    'email_drafts', 'sent_emails', 'followup_schedules', 'recruiter_activities'
  ]
  LOOP
    CONTINUE WHEN to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_all" ON %I
         USING (auth_is_approved()) WITH CHECK (auth_is_approved())', t);
  END LOOP;
END $$;

-- 4b. Tables whose policy carries its own name (later migrations).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('video_call_recordings', 'vcr_authenticated'),           -- 010
    ('bookings',              'bookings_authenticated'),      -- 011
    ('agents',                'agents_all_authenticated'),    -- 017 (staged)
    ('agent_runs',            'agent_runs_all_authenticated'),-- 017 (staged)
    ('approval_items',        'approval_items_all_authenticated') -- 018 (staged)
  ) AS v(tbl, pol)
  LOOP
    CONTINUE WHEN to_regclass(format('public.%I', r.tbl)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.pol, r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I
         USING (auth_is_approved()) WITH CHECK (auth_is_approved())',
      r.pol, r.tbl);
  END LOOP;
END $$;

-- 4c. Settings + usage tables read by any authenticated user in 002.
DROP POLICY IF EXISTS "admin_only" ON ai_recruiter_settings;
CREATE POLICY "admin_only" ON ai_recruiter_settings
  USING (auth_is_approved()) WITH CHECK (auth_is_admin());

DROP POLICY IF EXISTS "admin_only_write" ON app_settings;
CREATE POLICY "admin_only_write" ON app_settings
  FOR SELECT USING (auth_is_approved());

DROP POLICY IF EXISTS "llm_usage_insert" ON llm_usage;
CREATE POLICY "llm_usage_insert" ON llm_usage
  FOR INSERT TO authenticated WITH CHECK (auth_is_approved());

-- 4d. Blog + careers form: the PUBLIC halves stay public (marketing pages and
--     the careers form must work for logged-out visitors). Only the
--     authenticated halves gain the gate.
DROP POLICY IF EXISTS "public_read_published" ON blog_posts;
CREATE POLICY "public_read_published" ON blog_posts
  FOR SELECT USING (status = 'published' OR auth_is_approved());

DROP POLICY IF EXISTS "auth_write" ON blog_posts;
CREATE POLICY "auth_write" ON blog_posts
  FOR ALL USING (auth_is_approved()) WITH CHECK (auth_is_approved());

DROP POLICY IF EXISTS "auth_read" ON form_submissions;
CREATE POLICY "auth_read" ON form_submissions
  FOR SELECT USING (auth_is_approved());
-- "public_insert" on form_submissions is left WITH CHECK (TRUE) on purpose.

-- 4e. audit_logs INSERT deliberately stays open to any authenticated user:
--     the blocked-access events we most want recorded are written BY unapproved
--     users (Layout.jsx logs the denial). Reads remain admin-only via the now-
--     hardened auth_is_admin().

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE — same gate. 010 let any authenticated user read every recording
--    in the bucket (call recordings contain candidate PII).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rec_select" ON storage.objects;
CREATE POLICY "rec_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-recordings' AND auth_is_approved());

DROP POLICY IF EXISTS "rec_insert" ON storage.objects;
CREATE POLICY "rec_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-recordings' AND auth_is_approved());

DROP POLICY IF EXISTS "rec_update" ON storage.objects;
CREATE POLICY "rec_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'meeting-recordings' AND auth_is_approved());

DROP POLICY IF EXISTS "rec_delete" ON storage.objects;
CREATE POLICY "rec_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'meeting-recordings' AND auth_is_approved());

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these after applying.
-- ═══════════════════════════════════════════════════════════════════════════

-- (a) At least one approved admin must survive, or nobody can approve anyone.
--     016 backfilled existing users to 'active', so this should be non-empty.
--     If it IS empty, fix it here (service role bypasses the guard trigger):
--       UPDATE user_profiles SET role='admin', status='active', is_locked=FALSE
--        WHERE email = 'saradhi.0003@gmail.com';
SELECT email, role, status, is_locked
  FROM user_profiles
 WHERE role = 'admin' AND status = 'active' AND COALESCE(is_locked, FALSE) = FALSE;

-- (b) No policy should still gate on bare authentication.
--     Expect only the intended exceptions: form_submissions/public_insert,
--     audit_logs/auth_insert, user_profiles/* .
SELECT tablename, policyname, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND qual LIKE '%uid() IS NOT NULL%'
 ORDER BY tablename;

-- (c) The real test is NOT in SQL — see AUTH_SETUP.md §4: sign in as an
--     'invited' user and curl PostgREST directly with their token. It must
--     return [] for candidates, not rows.
