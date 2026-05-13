-- ═══════════════════════════════════════════════════════════════════════════
-- Recruiter X — Row-Level Security Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE user_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters                ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails            ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_channel_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recruiter_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recruiter_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_match_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails               ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_registrations    ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: is the calling user an admin?
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_profiles: users can read/update their own profile; admins see all
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (id = auth.uid() OR auth_is_admin());

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid() OR auth_is_admin());

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR auth_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Core recruiting data: authenticated users can read/write
-- (In production, scope further by workspace/team)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "authenticated_all" ON candidates
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON companies
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON jobs
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON recruiters
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON applications
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON submissions
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON resumes
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON tasks
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON consultants
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON playbooks
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON automation_rules
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON email_templates
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON invoices
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON expenses
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON timesheets
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON leave_requests
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON inbound_emails
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON inbound_channel_messages
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON ai_recruiter_runs
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON candidate_match_results
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON email_drafts
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON sent_emails
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON followup_schedules
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_all" ON recruiter_activities
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin-only tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_only" ON channel_connections
  USING (auth_is_admin()) WITH CHECK (auth_is_admin());

CREATE POLICY "admin_only" ON whatsapp_registrations
  USING (auth_is_admin()) WITH CHECK (auth_is_admin());

CREATE POLICY "admin_only" ON ai_recruiter_settings
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth_is_admin());

CREATE POLICY "admin_only_write" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_only_write_mutation" ON app_settings
  FOR ALL USING (auth_is_admin()) WITH CHECK (auth_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Public: blog posts and form submissions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "public_read_published" ON blog_posts
  FOR SELECT USING (status = 'published' OR auth.uid() IS NOT NULL);

CREATE POLICY "auth_write" ON blog_posts
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Anyone can submit a form (careers page etc.)
CREATE POLICY "public_insert" ON form_submissions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "auth_read" ON form_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Audit log: insert allowed for authenticated, read admin only
CREATE POLICY "auth_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admin_read" ON audit_logs
  FOR SELECT USING (auth_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Service-role bypass: all policies are bypassed for service_role key
-- (used by Edge Functions and bots — this is Supabase default behaviour)
-- ─────────────────────────────────────────────────────────────────────────────
