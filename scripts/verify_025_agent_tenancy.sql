-- ═══════════════════════════════════════════════════════════════════════════
-- verify_025_agent_tenancy.sql — confirm migration 025 actually landed.
-- Read-only. Paste into the Supabase SQL editor and run; every row should PASS.
--
-- 025 workspace-scopes agents / agent_runs / approval_items, which 024's
-- tenant_tables[] array omitted, and clears four advisor findings.
--
-- ⚠ Every table reference is schema-qualified and search_path is pinned. The
--   first version referenced a bare `user_profiles`, which threw
--   "relation does not exist" in a SQL editor session whose search_path did not
--   include `public`. Keep the qualification.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path = public, pg_catalog;

WITH checks AS (

-- ── 1. workspace_id is NOT NULL on all three ────────────────────────────────
SELECT 1 AS ord, '025  agents/agent_runs/approval_items.workspace_id NOT NULL' AS check_name,
  CASE WHEN (SELECT count(*) FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'workspace_id'
               AND is_nullable = 'NO'
               AND table_name IN ('agents','agent_runs','approval_items')) = 3
       THEN 'PASS' ELSE 'FAIL — run 025' END AS result

-- ── 2. FK to workspaces, so a bogus workspace_id cannot be written ──────────
UNION ALL SELECT 2, '025  all three have a workspace_id FK to workspaces',
  CASE WHEN (SELECT count(DISTINCT tc.table_name)
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON kcu.constraint_name = tc.constraint_name
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND kcu.column_name = 'workspace_id'
               AND tc.table_name IN ('agents','agent_runs','approval_items')) = 3
       THEN 'PASS' ELSE 'FAIL' END

-- ── 3. stamp trigger present, so ordinary client INSERTs still work ─────────
UNION ALL SELECT 3, '025  stamp_workspace_id trigger on all three',
  CASE WHEN (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
             WHERE NOT t.tgisinternal
               AND c.relname IN ('agents','agent_runs','approval_items')
               AND t.tgname LIKE 'trg_%_stamp_ws') = 3
       THEN 'PASS' ELSE 'FAIL — client inserts will fail the NOT NULL check' END

-- ── 4. THE load-bearing one: policies are workspace-scoped, not approval-only ─
UNION ALL SELECT 4, '025  policies scope by workspace AND approval',
  CASE WHEN (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename IN ('agents','agent_runs','approval_items')
               AND coalesce(qual,'')       LIKE '%auth_workspace_id%'
               AND coalesce(qual,'')       LIKE '%auth_is_approved%'
               AND coalesce(with_check,'') LIKE '%auth_workspace_id%') = 3
       THEN 'PASS' ELSE 'FAIL — cross-tenant read/write still possible' END

-- ── 5. no legacy approval-only policy survives on these tables ──────────────
--     (020 rewrote the BODY but kept the *_all_authenticated NAME, which is why
--      a name-only audit reported these as ungated. Check the body, not the name.)
UNION ALL SELECT 5, '025  no approval-only policy left on the three tables',
  CASE WHEN (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename IN ('agents','agent_runs','approval_items')
               AND coalesce(qual,'') NOT LIKE '%auth_workspace_id%') = 0
       THEN 'PASS' ELSE 'FAIL — ' || (SELECT string_agg(tablename||'.'||policyname, ', ')
              FROM pg_policies WHERE schemaname='public'
                AND tablename IN ('agents','agent_runs','approval_items')
                AND coalesce(qual,'') NOT LIKE '%auth_workspace_id%') END

-- ── 6. RLS actually enabled (a policy on a table with RLS off is decoration) ─
UNION ALL SELECT 6, '025  RLS enabled on all three',
  CASE WHEN (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relrowsecurity
               AND c.relname IN ('agents','agent_runs','approval_items')) = 3
       THEN 'PASS' ELSE 'FAIL' END

-- ── 7. advisor: trigger-only functions no longer callable over PostgREST ────
UNION ALL SELECT 7, '025  trigger-only functions not EXECUTE-able by anon',
  CASE WHEN NOT EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('audit_entity_change','rls_auto_enable',
                             'sync_recruiter_from_profile','guard_user_profile_privileges')
           AND has_function_privilege('anon', p.oid, 'EXECUTE'))
       THEN 'PASS' ELSE 'FAIL — still exposed at /rest/v1/rpc/' END

-- ── 8. advisor: search_path pinned on the two mutable-path functions ────────
UNION ALL SELECT 8, '025  stamp_workspace_id + immutable_array_to_string paths pinned',
  CASE WHEN (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('stamp_workspace_id','immutable_array_to_string')
               AND array_to_string(coalesce(p.proconfig,'{}'), ',') LIKE '%search_path%') = 2
       THEN 'PASS' ELSE 'FAIL' END

-- ── 9. the auth helpers must STAY executable — revoking them breaks every ───
--     gated query, and anon needs auth_is_approved() for the blog_posts policy.
UNION ALL SELECT 9, '025  auth helpers still EXECUTE-able (must NOT be revoked)',
  CASE WHEN (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('auth_is_approved','auth_is_admin','auth_workspace_id')
               AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 3
       THEN 'PASS' ELSE 'FAIL — RLS is now broken; re-GRANT immediately' END

-- ── 10. safety: at least one usable admin survives ─────────────────────────
UNION ALL SELECT 10, '025  an approved, unlocked admin still exists',
  CASE WHEN (SELECT count(*) FROM public.user_profiles
             WHERE role = 'admin' AND status = 'active' AND is_locked IS NOT TRUE) > 0
       THEN 'PASS' ELSE 'FAIL — you are locked out' END

)
SELECT check_name, result FROM checks ORDER BY ord;
