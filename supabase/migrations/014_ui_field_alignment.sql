-- ═══════════════════════════════════════════════════════════════════════════
-- 014_ui_field_alignment.sql
--   UI ↔ database field alignment (2026-07-06 audit).
--
--   Several forms spread their entire formData into Entity.create/update, and
--   these fields had no matching column → PostgREST PGRST204 → "save fails".
--   This migration adds every UI-sent field so all form saves persist.
--   (CandidateForm's camelCase `addedExperience` is renamed to
--   `added_experience` in code alongside this migration.)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- candidates (CandidateForm spreads formData)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title      TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_expectation NUMERIC(12,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS added_experience   TEXT;

-- companies (CompanyForm: Job Stack visibility toggle)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS job_stack_access BOOLEAN DEFAULT FALSE;

-- consultants (ConsultantForm: tag chips)
ALTER TABLE consultants ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- recruiters (RecruiterForm spreads formData)
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS first_name       TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS last_name        TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role             TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS territory        TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS commission_rate  NUMERIC(6,2);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS specializations  TEXT[] DEFAULT '{}';

-- playbooks (PlaybookForm sends formData raw)
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'public';
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS documents    JSONB  DEFAULT '[]';
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS tags         TEXT[] DEFAULT '{}';

-- automation_rules (AutomationRuleForm sends formData raw)
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS trigger_type           TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS trigger_entity         TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS trigger_status_from    TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS trigger_status_to      TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS action_type            TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS email_recipient_type   TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS email_custom_recipient TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS email_template_id      UUID REFERENCES email_templates(id) ON DELETE SET NULL;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS delay_minutes          INTEGER DEFAULT 0;

COMMIT;

-- Make new columns visible to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
