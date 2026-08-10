-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 029: Fix guard_user_profile_privileges() forcing a NOT NULL
-- column to NULL on every self-bootstrap signup, silently breaking signup.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS — found via tests/smoke/signup-journey.spec.js, the first
-- time it was ever run to completion (it needs RX_SERVICE_ROLE_KEY, which
-- had never been supplied before).
--
-- `guard_user_profile_privileges()` (migration 024) pins the privileged
-- columns on a self-bootstrap INSERT (AuthContext.jsx creating a new user's
-- own row on first login) so a signup can never grant itself elevated
-- access:
--
--   NEW.role         := 'recruiter';
--   NEW.status       := 'invited';
--   NEW.is_locked    := FALSE;
--   NEW.workspace_id := NULL;          -- <- the bug
--
-- `user_profiles.workspace_id` is NOT NULL. Forcing it to NULL — rather than
-- leaving it alone to take the column's own DEFAULT
-- ('00000000-0000-0000-0000-000000000001', the same DEFAULT_WORKSPACE_ID
-- constant _shared/auth.ts uses) or setting that value explicitly — makes
-- the INSERT violate the NOT NULL constraint on every single self-bootstrap,
-- unconditionally. Since 024 shipped, no new user has ever gotten a real
-- `user_profiles` row this way.
--
-- The failure was invisible because AuthContext.jsx's bootstrap never checks
-- the insert's error:
--
--   const { data: created } = await supabase.from("user_profiles")
--     .insert({...}).select().single();
--   effectiveProfile = created || { status: "invited", role: "recruiter" };
--
-- `created` is undefined on failure, so the `||` falls back to a **local,
-- never-persisted** object. React believed the user was "invited" and
-- rendered the pending-approval screen correctly — but the database had no
-- row at all, so every OTHER thing that reads user_profiles directly
-- (appCache.getUserCached, entities/User.me/.list, Role.list/filter) saw a
-- genuinely empty result, not a permissions problem. Depending on which of
-- those independent implementations happened to be consulted at a given
-- moment, the same unrecognized user was either wrongly blocked (once the
-- appCache fail-open bug was fixed) or wrongly let through the app shell
-- (before it was), because "the row doesn't exist" was never a state any of
-- them handled explicitly. Fixing the actual cause here is what makes the
-- rest of that behavior coherent instead of two separate bugs papering over
-- a third.

CREATE OR REPLACE FUNCTION guard_user_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth_is_admin() THEN
    RETURN NEW;                       -- service role, SQL editor, or an admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Self-bootstrap (AuthContext.jsx) may create a row, never a privileged
    -- one. workspace_id is NOT NULL — pin it to the shared default rather
    -- than nulling it out, or the insert fails the column constraint outright.
    NEW.role         := 'recruiter';
    NEW.status       := 'invited';
    NEW.is_locked    := FALSE;
    NEW.workspace_id := '00000000-0000-0000-0000-000000000001'::uuid;
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
END
$$;
