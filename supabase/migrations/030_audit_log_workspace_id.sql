-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 030: Give audit_entity_change() a workspace_id, so service-role
-- writes to audited tables stop failing outright.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
-- audit_logs.workspace_id is NOT NULL with no default, and
-- audit_entity_change() never set it:
--
--   INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data)
--   VALUES (...);
--
-- The only thing filling it was stamp_workspace_id() -> auth_workspace_id(),
-- which reads `user_profiles WHERE id = auth.uid()`. Every Edge Function uses
-- the SERVICE-ROLE client (_shared/supabaseClient.ts), where auth.uid() is
-- NULL — so the lookup returned NULL, the NOT NULL constraint rejected the
-- audit row, and because the audit trigger fires inside the same transaction,
-- it took the ORIGINAL write down with it.
--
-- The blast radius is every audited table — candidates, jobs, submissions,
-- companies, tasks — for every INSERT, UPDATE and DELETE performed by the
-- service role. That is the entire automated write path:
--   channelMessageWebhook / inboundEmailWebhook  -> create candidates + jobs
--   parseResumeFile                              -> create candidates
--   aiRecruiterParseJob                          -> create jobs
-- all of which fail with a NOT NULL violation on a table they never touch.
--
-- Commit 4e19028 hit this and worked around it by running a one-off backfill
-- as the admin over PostgREST "rather than as the service role" — the
-- workaround was recorded, the underlying trigger was never fixed.
--
-- THE FIX
-- An audit row belongs to the same workspace as the row it audits, which is
-- available right there on NEW/OLD — no auth context needed. Fall back to
-- auth_workspace_id() (real user sessions), then to DEFAULT_WORKSPACE_ID so a
-- table without the column can still be audited rather than blocking the write.

CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email TEXT;
  v_workspace  UUID;
BEGIN
  BEGIN
    SELECT email INTO v_user_email FROM user_profiles WHERE id = auth.uid() LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  -- Take the workspace from the audited row itself. to_jsonb(...)->>'workspace_id'
  -- rather than NEW.workspace_id so this stays generic across every table the
  -- trigger is attached to, including any that lack the column.
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_workspace := NULLIF(to_jsonb(OLD) ->> 'workspace_id', '')::uuid;
    ELSE
      v_workspace := NULLIF(to_jsonb(NEW) ->> 'workspace_id', '')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_workspace := NULL;
  END;

  IF v_workspace IS NULL THEN
    v_workspace := auth_workspace_id();
  END IF;
  IF v_workspace IS NULL THEN
    v_workspace := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data, workspace_id)
    VALUES (coalesce(v_user_email, 'system'), 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD), NULL, v_workspace);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data, workspace_id)
    VALUES (coalesce(v_user_email, 'system'), 'update', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW), v_workspace);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_email, action, entity_type, entity_id, old_data, new_data, workspace_id)
    VALUES (coalesce(v_user_email, 'system'), 'create', TG_TABLE_NAME, NEW.id, NULL, row_to_json(NEW), v_workspace);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Same class of bug, same cause: sync_recruiter_from_profile() inserts into
-- `recruiters` (NOT NULL workspace_id) without one, so creating a user profile
-- as the service role — the admin/invite path — died on the recruiters insert.
-- Carry the profile's own workspace across.
CREATE OR REPLACE FUNCTION sync_recruiter_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO recruiters (id, full_name, email, status, workspace_id)
  VALUES (
    NEW.id,
    coalesce(NEW.full_name, NEW.email),
    NEW.email,
    'active',
    coalesce(NEW.workspace_id, auth_workspace_id(), '00000000-0000-0000-0000-000000000001'::uuid)
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;
  RETURN NEW;
END;
$$;
