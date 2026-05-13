-- ═══════════════════════════════════════════════════════════════════════════
-- Recruiter X — Complete Schema Migration
-- Run against a fresh Supabase project (or with supabase db push)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- UTILITY: auto-set created_at / updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- USER PROFILES  (extends Supabase auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','member','viewer')),
  workspace_id  TEXT,
  phone         TEXT,
  title         TEXT,
  preferences   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- CANDIDATES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  location            TEXT,
  title               TEXT,
  summary             TEXT,
  skills              TEXT[] DEFAULT '{}',
  experience_years    INTEGER,
  current_company     TEXT,
  current_position    TEXT,
  desired_salary      TEXT,
  notice_period       TEXT,
  availability        TEXT,
  visa_status         TEXT,
  linkedin_url        TEXT,
  resume_url          TEXT,
  source              TEXT DEFAULT 'manual'
                        CHECK (source IN ('manual','linkedin','referral','job_board','channel','email','imported')),
  status              TEXT DEFAULT 'active'
                        CHECK (status IN ('active','passive','inactive','placed','blacklisted')),
  rating              NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 5),
  tags                TEXT[] DEFAULT '{}',
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_skills ON candidates USING GIN(skills);
CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  industry      TEXT,
  size          TEXT,
  website       TEXT,
  location      TEXT,
  description   TEXT,
  logo_url      TEXT,
  linkedin_url  TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','prospect','client')),
  notes         TEXT,
  tags          TEXT[] DEFAULT '{}',
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name      TEXT,
  location          TEXT,
  job_type          TEXT DEFAULT 'full_time'
                      CHECK (job_type IN ('full_time','part_time','contract','c2c','remote','hybrid')),
  salary_range      TEXT,
  description       TEXT,
  requirements      TEXT,
  skills_required   TEXT[] DEFAULT '{}',
  experience_min    INTEGER,
  experience_max    INTEGER,
  status            TEXT DEFAULT 'open'
                      CHECK (status IN ('open','closed','on_hold','filled','cancelled')),
  priority          TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  source            TEXT DEFAULT 'manual'
                      CHECK (source IN ('manual','email','telegram','slack','whatsapp','job_board','referral')),
  source_message_id TEXT,
  posted_by         TEXT,
  closing_date      DATE,
  openings          INTEGER DEFAULT 1,
  tags              TEXT[] DEFAULT '{}',
  notes             TEXT,
  raw_text          TEXT,
  parsed_at         TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs USING GIN(skills_required);
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RECRUITERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  title         TEXT,
  specialties   TEXT[] DEFAULT '{}',
  bio           TEXT,
  avatar_url    TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_recruiters_updated_at
  BEFORE UPDATE ON recruiters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- APPLICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'applied'
                    CHECK (status IN ('applied','screening','interview','offer','hired','rejected','withdrawn')),
  stage           TEXT,
  applied_date    DATE DEFAULT CURRENT_DATE,
  interview_date  TIMESTAMPTZ,
  offer_date      DATE,
  offer_amount    TEXT,
  rejection_reason TEXT,
  notes           TEXT,
  score           NUMERIC(5,2),
  recruiter_id    UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  source          TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBMISSIONS (candidate submitted to client)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,
  candidate_id      UUID REFERENCES candidates(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  recruiter_id      UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'submitted'
                      CHECK (status IN ('submitted','interviewing','offered','hired','rejected','withdrawn')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  submitted_by      TEXT,
  contact_email     TEXT,
  contact_name      TEXT,
  submission_notes  TEXT,
  client_feedback   TEXT,
  bill_rate         NUMERIC(10,2),
  pay_rate          NUMERIC(10,2),
  placement_fee     NUMERIC(10,2),
  start_date        DATE,
  end_date          DATE,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submissions_job_id ON submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_submissions_candidate_id ON submissions(candidate_id);
CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RESUMES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  file_url        TEXT,
  file_name       TEXT,
  file_size       INTEGER,
  mime_type       TEXT,
  raw_text        TEXT,
  parsed_data     JSONB DEFAULT '{}',
  parsing_status  TEXT DEFAULT 'pending'
                    CHECK (parsing_status IN ('pending','processing','done','failed')),
  parsed_at       TIMESTAMPTZ,
  is_primary      BOOLEAN DEFAULT FALSE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_id ON resumes(candidate_id);
CREATE TRIGGER trg_resumes_updated_at
  BEFORE UPDATE ON resumes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date        DATE,
  assigned_to     TEXT,
  related_entity_type TEXT,
  related_entity_id   UUID,
  entity_type         TEXT,
  entity_id           UUID,
  tags            TEXT[] DEFAULT '{}',
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSULTANTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  skills              TEXT[] DEFAULT '{}',
  title               TEXT,
  location            TEXT,
  rate_per_hour       NUMERIC(10,2),
  availability        TEXT,
  status              TEXT DEFAULT 'available'
                        CHECK (status IN ('available','on_project','unavailable')),
  linkedin_url        TEXT,
  resume_url          TEXT,
  current_project     TEXT,
  project_end_date    DATE,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_consultants_updated_at
  BEFORE UPDATE ON consultants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PLAYBOOKS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  steps         JSONB DEFAULT '[]',
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTOMATION RULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_event   TEXT NOT NULL,
  conditions      JSONB DEFAULT '{}',
  actions         JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  run_count       INTEGER DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  category      TEXT DEFAULT 'general'
                  CHECK (category IN ('general','outreach','follow_up','submission','rejection','offer')),
  variables     TEXT[] DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  submission_id   UUID REFERENCES submissions(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) NOT NULL,
  tax             NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date      DATE DEFAULT CURRENT_DATE,
  due_date        DATE,
  paid_date       DATE,
  notes           TEXT,
  line_items      JSONB DEFAULT '[]',
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  category        TEXT DEFAULT 'other'
                    CHECK (category IN ('travel','software','marketing','office','other')),
  date            DATE DEFAULT CURRENT_DATE,
  receipt_url     TEXT,
  notes           TEXT,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','reimbursed')),
  submitted_by    TEXT,
  approved_by     TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- TIMESHEETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID REFERENCES consultants(id) ON DELETE SET NULL,
  submission_id   UUID REFERENCES submissions(id) ON DELETE SET NULL,
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  hours_worked    NUMERIC(6,2) NOT NULL,
  rate_per_hour   NUMERIC(10,2),
  total_amount    NUMERIC(12,2),
  status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','approved','rejected','invoiced')),
  notes           TEXT,
  submitted_by    TEXT,
  approved_by     TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- LEAVE REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recruiter_id    UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  leave_type      TEXT DEFAULT 'vacation'
                    CHECK (leave_type IN ('vacation','sick','personal','unpaid','other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_requested  NUMERIC(4,1),
  reason          TEXT,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by     TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOG POSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE,
  content         TEXT,
  excerpt         TEXT,
  cover_image_url TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  author          TEXT,
  tags            TEXT[] DEFAULT '{}',
  published_at    TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- FORM SUBMISSIONS (landing / careers page)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type     TEXT NOT NULL DEFAULT 'contact'
                  CHECK (form_type IN ('contact','career','demo','general')),
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  message       TEXT,
  resume_url    TEXT,
  job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  metadata      JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'new' CHECK (status IN ('new','reviewed','converted','spam')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- APP SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT UNIQUE NOT NULL,
  value         JSONB,
  description   TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- INBOUND EMAILS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email      TEXT NOT NULL,
  from_name       TEXT,
  to_email        TEXT,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  message_id      TEXT UNIQUE,
  in_reply_to     TEXT,
  thread_id       TEXT,
  attachments     JSONB DEFAULT '[]',
  raw_payload     JSONB DEFAULT '{}',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT DEFAULT 'pending'
                    CHECK (processing_status IN ('pending','processed','failed','ignored')),
  processed_at    TIMESTAMPTZ,
  resulting_entity_type TEXT,
  resulting_entity_id   UUID,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_processing_status ON inbound_emails(processing_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHANNEL CONNECTIONS  (Telegram, Slack, WhatsApp)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            TEXT,
  channel_type            TEXT NOT NULL
                            CHECK (channel_type IN ('telegram','slack','email_inbound','whatsapp')),
  channel_name            TEXT,
  external_id             TEXT NOT NULL,
  credentials             JSONB DEFAULT '{}',
  is_active               BOOLEAN DEFAULT TRUE,
  filter_keywords         TEXT[] DEFAULT '{}',
  default_classification  TEXT DEFAULT 'auto'
                            CHECK (default_classification IN ('auto','job','resume')),
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_type, external_id)
);
CREATE TRIGGER trg_channel_connections_updated_at
  BEFORE UPDATE ON channel_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- INBOUND CHANNEL MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_channel_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_connection_id   UUID REFERENCES channel_connections(id) ON DELETE SET NULL,
  channel_type            TEXT NOT NULL
                            CHECK (channel_type IN ('telegram','slack','email_inbound','whatsapp')),
  external_message_id     TEXT NOT NULL,
  sender                  TEXT,
  sender_name             TEXT,
  subject                 TEXT,
  body                    TEXT NOT NULL,
  attachments             JSONB DEFAULT '[]',
  raw_payload             JSONB DEFAULT '{}',
  received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classification          TEXT
                            CHECK (classification IN ('job','resume','reply','spam','unknown')),
  classification_confidence NUMERIC(4,3) CHECK (classification_confidence >= 0 AND classification_confidence <= 1),
  processing_status       TEXT DEFAULT 'pending'
                            CHECK (processing_status IN ('pending','processed','failed','ignored')),
  processed_at            TIMESTAMPTZ,
  resulting_entity_type   TEXT CHECK (resulting_entity_type IN ('Job','Candidate','Application')),
  resulting_entity_id     UUID,
  ai_recruiter_run_id     UUID,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_icm_channel_type ON inbound_channel_messages(channel_type);
CREATE INDEX IF NOT EXISTS idx_icm_processing_status ON inbound_channel_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_icm_connection_id ON inbound_channel_messages(channel_connection_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- AI RECRUITER SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recruiter_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_model               TEXT DEFAULT 'gpt-4o-mini',
  matching_model              TEXT DEFAULT 'gpt-4o-mini',
  drafting_model              TEXT DEFAULT 'gpt-4o',
  parsing_model               TEXT DEFAULT 'gpt-4o-mini',
  max_candidates              INTEGER DEFAULT 50,
  minimum_match_score         INTEGER DEFAULT 50,
  require_human_approval      BOOLEAN DEFAULT TRUE,
  gmail_draft_enabled         BOOLEAN DEFAULT FALSE,
  zoho_sync_enabled           BOOLEAN DEFAULT FALSE,
  openai_enabled              BOOLEAN DEFAULT TRUE,
  fallback_to_base44_llm      BOOLEAN DEFAULT TRUE,
  auto_match_enabled          BOOLEAN DEFAULT TRUE,
  auto_draft_on_match         BOOLEAN DEFAULT FALSE,
  auto_draft_clarification    BOOLEAN DEFAULT TRUE,
  send_immediately_on_approval BOOLEAN DEFAULT TRUE,
  auto_followup_enabled       BOOLEAN DEFAULT TRUE,
  default_followup_cadence    INTEGER DEFAULT 3,
  max_followups               INTEGER DEFAULT 3,
  workspace_timezone          TEXT DEFAULT 'UTC',
  followup_send_hour          INTEGER DEFAULT 9,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_ai_recruiter_settings_updated_at
  BEFORE UPDATE ON ai_recruiter_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- AI RECRUITER RUNS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recruiter_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                  UUID REFERENCES jobs(id) ON DELETE SET NULL,
  source                  TEXT DEFAULT 'manual'
                            CHECK (source IN ('manual','gmail','zoho','inbound_email','app','channel')),
  source_id               TEXT,
  status                  TEXT DEFAULT 'started'
                            CHECK (status IN ('started','parsed','matched','draft_created','approved','completed','failed')),
  selected_candidate_ids  UUID[] DEFAULT '{}',
  match_count             INTEGER,
  draft_count             INTEGER,
  summary                 TEXT,
  error_message           TEXT,
  model_used              TEXT,
  started_at              TIMESTAMPTZ DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_job_id ON ai_recruiter_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_recruiter_runs(status);
CREATE TRIGGER trg_ai_recruiter_runs_updated_at
  BEFORE UPDATE ON ai_recruiter_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- CANDIDATE MATCH RESULTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_match_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID REFERENCES ai_recruiter_runs(id) ON DELETE CASCADE,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  candidate_id        UUID REFERENCES candidates(id) ON DELETE SET NULL,
  score               NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  recommendation      TEXT CHECK (recommendation IN ('strong_submit','maybe','not_recommended')),
  matched_skills      TEXT[] DEFAULT '{}',
  missing_skills      TEXT[] DEFAULT '{}',
  risk_flags          TEXT[] DEFAULT '{}',
  strengths           TEXT[] DEFAULT '{}',
  weaknesses          TEXT[] DEFAULT '{}',
  ai_summary          TEXT,
  explanation         TEXT,
  model_used          TEXT,
  recruiter_feedback  TEXT,
  recruiter_action    TEXT DEFAULT 'none'
                        CHECK (recruiter_action IN ('none','selected','rejected','submitted','contacted')),
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmr_run_id ON candidate_match_results(run_id);
CREATE INDEX IF NOT EXISTS idx_cmr_candidate_id ON candidate_match_results(candidate_id);
CREATE TRIGGER trg_candidate_match_results_updated_at
  BEFORE UPDATE ON candidate_match_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- EMAIL DRAFTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID REFERENCES ai_recruiter_runs(id) ON DELETE SET NULL,
  job_id                UUID REFERENCES jobs(id) ON DELETE SET NULL,
  candidate_ids         UUID[] DEFAULT '{}',
  company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
  draft_type            TEXT NOT NULL
                          CHECK (draft_type IN ('client_submission','candidate_outreach','follow_up','internal_note','recruiter_clarification','followup')),
  channel               TEXT DEFAULT 'app' CHECK (channel IN ('app','gmail','zoho')),
  to_email              TEXT,
  cc                    TEXT,
  subject               TEXT NOT NULL,
  body                  TEXT NOT NULL,
  status                TEXT DEFAULT 'draft'
                          CHECK (status IN ('draft','approved','rejected','sent','send_failed')),
  external_draft_id     TEXT,
  created_by_ai         BOOLEAN DEFAULT TRUE,
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  model_used            TEXT,
  followup_schedule_id  UUID,
  send_failed_reason    TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_drafts_run_id ON email_drafts(run_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE TRIGGER trg_email_drafts_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SENT EMAILS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sent_emails (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id              UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  to_email              TEXT NOT NULL,
  cc                    TEXT[],
  subject               TEXT NOT NULL,
  body                  TEXT NOT NULL,
  message_id            TEXT UNIQUE,
  in_reply_to           TEXT,
  thread_id             TEXT,
  provider              TEXT DEFAULT 'postmark'
                          CHECK (provider IN ('postmark','gmail','zoho','app')),
  provider_message_id   TEXT,
  status                TEXT DEFAULT 'sent'
                          CHECK (status IN ('sent','delivered','opened','replied','bounced','failed')),
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  related_entity_type   TEXT,
  related_entity_id     UUID,
  followup_schedule_id  UUID,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sent_emails_thread_id ON sent_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_message_id ON sent_emails(message_id);
CREATE TRIGGER trg_sent_emails_updated_at
  BEFORE UPDATE ON sent_emails
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLLOWUP SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS followup_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         UUID REFERENCES submissions(id) ON DELETE CASCADE,
  recipient_email       TEXT NOT NULL,
  thread_message_id     TEXT,
  next_followup_date    DATE,
  followup_count        INTEGER DEFAULT 0,
  last_inbound_reply_at TIMESTAMPTZ,
  last_outbound_at      TIMESTAMPTZ,
  status                TEXT DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','drafted','sent','completed','stopped')),
  cadence_days          INTEGER DEFAULT 3,
  max_followups         INTEGER DEFAULT 3,
  draft_id              UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  stop_reason           TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followup_submission_id ON followup_schedules(submission_id);
CREATE INDEX IF NOT EXISTS idx_followup_status ON followup_schedules(status);
CREATE TRIGGER trg_followup_schedules_updated_at
  BEFORE UPDATE ON followup_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RECRUITER ACTIVITIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiter_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES ai_recruiter_runs(id) ON DELETE SET NULL,
  entity_type     TEXT NOT NULL
                    CHECK (entity_type IN ('job','candidate','submission','email','task','system')),
  entity_id       UUID,
  activity_type   TEXT NOT NULL
                    CHECK (activity_type IN (
                      'ai_job_parsed','ai_candidates_matched','ai_candidate_selected',
                      'ai_email_draft_created','ai_email_draft_approved','ai_email_draft_rejected',
                      'ai_submission_created','ai_task_created','ai_error','manual_action'
                    )),
  title           TEXT NOT NULL,
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_entity ON recruiter_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_run_id ON recruiter_activities(run_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_created_at ON recruiter_activities(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP REGISTRATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT UNIQUE NOT NULL,
  workspace_id          TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  registered_phone      TEXT,
  channel_connection_id UUID REFERENCES channel_connections(id) ON DELETE SET NULL,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_registrations_code ON whatsapp_registrations(code);

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW job_view AS
  SELECT j.*, c.name AS company_name_resolved, c.logo_url AS company_logo_url
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id;

CREATE OR REPLACE VIEW company_view AS
  SELECT
    c.*,
    COUNT(DISTINCT j.id) AS open_jobs_count,
    COUNT(DISTINCT s.id) AS submissions_count
  FROM companies c
  LEFT JOIN jobs j ON j.company_id = c.id AND j.status = 'open'
  LEFT JOIN submissions s ON s.company_id = c.id
  GROUP BY c.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: default AI recruiter settings row
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO ai_recruiter_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;
