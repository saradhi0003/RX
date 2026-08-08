-- ═══════════════════════════════════════════════════════════════════════════
-- 025_agent_tables_tenancy.sql — workspace-scope the three agent tables,
--                                plus two advisor fixes.
--
-- WHY
-- 024 workspace-scopes every tenant table by iterating a hardcoded
-- tenant_tables[] array (024:93-104). That array omits `agents`, `agent_runs`
-- and `approval_items` — they were added by 017/018, which were still staged on
-- feat/ai-core when 024 was written. So those three kept the policy 020 gave
-- them: approval-gated (`auth_is_approved()`) but NOT workspace-scoped.
--
-- Verified on the live project before writing this:
--   agents / agent_runs / approval_items  ->  USING auth_is_approved()
--   candidates                            ->  USING (workspace_id = auth_workspace_id()
--                                                    AND auth_is_approved())
--
-- The approval gate IS holding (the legacy policy *name* is misleading — 020
-- rewrote the body and kept the name). The gap is tenancy: any approved user of
-- workspace B can read and write workspace A's agents, runs and approval items.
-- Latent while only one workspace exists; live the moment a second one does.
--
-- RISK: none at apply time. All three tables are empty (verified: 0 rows), so
-- there is nothing to backfill and no query can start failing. The change is
-- purely restrictive and idempotent.
--
-- ⚠ EVERY identifier here is schema-qualified, and search_path is pinned below.
--   The first version of this file used bare table names inside format(), which
--   resolve through search_path — and the Supabase SQL editor session did not
--   have `public` on its path, so `ALTER TABLE agents` threw
--   "relation does not exist" and the whole BEGIN/COMMIT block rolled back
--   silently. Do not un-qualify these.
--
-- Apply AFTER 024. Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- Belt and braces: even fully-qualified DDL is easier to read with this set,
-- and it protects the unqualified helper references inside policy bodies.
SET LOCAL search_path = public, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tenancy: bring the three tables into the 024 pattern.
--    Mirrors the DO block at 024:93-118 — FK, backfill, NOT NULL, index,
--    stamp trigger — so there is one pattern in the schema, not two.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  agent_tables TEXT[] := ARRAY['agents', 'agent_runs', 'approval_items'];
BEGIN
  FOREACH t IN ARRAY agent_tables LOOP
    -- Skip cleanly if 017/018 were never applied on this project.
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '025: table public.% does not exist - skipping', t;
      CONTINUE;
    END IF;

    -- 017/018 already declare workspace_id UUID (nullable, no FK). Add the FK
    -- only if it is missing; ADD COLUMN IF NOT EXISTS covers a fresh project.
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id UUID', t);

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = t
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'workspace_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id)
           REFERENCES public.workspaces(id)', t, t || '_workspace_id_fkey');
    END IF;

    EXECUTE format(
      'UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL',
      t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_workspace ON public.%I(workspace_id)', t, t);

    -- The stamp trigger is what lets an ordinary client INSERT without naming a
    -- workspace. Service-role callers bypass it and must set it explicitly.
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_stamp_ws ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_stamp_ws BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace_id()', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Policies: drop the legacy-named approval-only policies, recreate them
--    workspace-scoped. Body copied from 024's `workspace_all`.
--    Dropping every historical name, since 017/018/020 each used a different one.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  agent_tables TEXT[] := ARRAY['agents', 'agent_runs', 'approval_items'];
BEGIN
  FOREACH t IN ARRAY agent_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS "workspace_all" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "workspace_all" ON public.%I
         FOR ALL TO authenticated
         USING       (workspace_id = public.auth_workspace_id() AND public.auth_is_approved())
         WITH CHECK  (workspace_id = public.auth_workspace_id() AND public.auth_is_approved())', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Advisor fix: trigger-only functions must not be callable over PostgREST.
--
-- `supabase db advisors` flags these as anon-executable SECURITY DEFINER
-- functions at /rest/v1/rpc/<name>. 021 intended to revoke RPC access to
-- trigger-only functions; these four were missed. They take no arguments and
-- only make sense as triggers, so revoking EXECUTE costs nothing — PostgreSQL
-- does not check EXECUTE privilege when firing a trigger.
--
-- ⚠ Do NOT extend this to auth_is_approved() / auth_is_admin() /
--   auth_workspace_id(). RLS policy expressions run with the CALLER's
--   privileges, so revoking those breaks every gated query, and `anon` needs
--   auth_is_approved() for the public blog_posts policy. See the note in 021.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fn TEXT;
  trigger_only TEXT[] := ARRAY[
    'audit_entity_change()',
    'rls_auto_enable()',
    'sync_recruiter_from_profile()',
    'guard_user_profile_privileges()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only LOOP
    IF to_regprocedure('public.' || fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Advisor fix: pin search_path on the two mutable-path functions.
--    Same hardening 021 applied elsewhere. stamp_workspace_id() is a trigger
--    function reached from every tenant INSERT, so an unpinned path there is
--    the more meaningful of the two.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.stamp_workspace_id()') IS NOT NULL THEN
    ALTER FUNCTION public.stamp_workspace_id() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.immutable_array_to_string(text[], text)') IS NOT NULL THEN
    ALTER FUNCTION public.immutable_array_to_string(text[], text) SET search_path = public, pg_temp;
  END IF;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify with scripts/verify_025_agent_tenancy.sql (all 10 rows must read PASS).
-- ─────────────────────────────────────────────────────────────────────────────
