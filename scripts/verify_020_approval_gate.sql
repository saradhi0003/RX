-- ═══════════════════════════════════════════════════════════════════════════
-- verify_020_approval_gate.sql — confirm migrations 017–020 actually landed.
-- Read-only. Paste into the Supabase SQL editor and run; every row should PASS.
-- ═══════════════════════════════════════════════════════════════════════════

WITH checks AS (

-- ── 017 / 018: the staged tables exist ──────────────────────────────────────
SELECT 1 AS ord, '017/018  agents, agent_runs, approval_items exist' AS check_name,
  CASE WHEN (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r'
               AND c.relname IN ('agents','agent_runs','approval_items')) = 3
       THEN 'PASS' ELSE 'FAIL — run 017 then 018' END AS result

-- ── 019: views re-check RLS as the caller ───────────────────────────────────
UNION ALL SELECT 2, '019      job/company/llm_usage views are security_invoker',
  CASE WHEN (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'v'
               AND c.relname IN ('job_view','company_view','llm_usage_summary')
               AND array_to_string(coalesce(c.reloptions, '{}'), ',') LIKE '%security_invoker=true%') = 3
       THEN 'PASS' ELSE 'FAIL — run 019' END

-- ── 020.1: the predicate, hardened correctly ────────────────────────────────
UNION ALL SELECT 3, '020      auth_is_approved() is SECURITY DEFINER + pinned path',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname = 'auth_is_approved'
                      AND p.prosecdef
                      AND array_to_string(coalesce(p.proconfig, '{}'), ',') LIKE '%search_path%')
       THEN 'PASS' ELSE 'FAIL' END

-- ── 020.2: a locked/inactive admin is no longer an admin ────────────────────
UNION ALL SELECT 4, '020      auth_is_admin() now requires active + unlocked',
  CASE WHEN (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin') LIKE '%is_locked%'
       THEN 'PASS' ELSE 'FAIL — still the 002 version' END

-- ── 020.3: self-approval is blocked ─────────────────────────────────────────
UNION ALL SELECT 5, '020      user_profiles privilege-guard trigger installed',
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                    WHERE c.relname = 'user_profiles' AND NOT t.tgisinternal
                      AND t.tgname = 'trg_guard_user_profile_privileges')
       THEN 'PASS' ELSE 'FAIL — users can still self-approve' END

-- ── 020.4: THE load-bearing one — approval compiled into the policies ───────
UNION ALL SELECT 6, '020      data policies now require auth_is_approved()',
  CASE WHEN (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'public'
               AND (coalesce(qual,'') LIKE '%auth_is_approved%'
                 OR coalesce(with_check,'') LIKE '%auth_is_approved%')) >= 28
       THEN 'PASS (' || (SELECT count(*)::text FROM pg_policies WHERE schemaname='public'
              AND (coalesce(qual,'') LIKE '%auth_is_approved%'
                OR coalesce(with_check,'') LIKE '%auth_is_approved%')) || ' policies)'
       ELSE 'FAIL — only ' || (SELECT count(*)::text FROM pg_policies WHERE schemaname='public'
              AND (coalesce(qual,'') LIKE '%auth_is_approved%'
                OR coalesce(with_check,'') LIKE '%auth_is_approved%')) || ' policies gated' END

-- ── 020.5: no ungated leftovers beyond the two intended exceptions ──────────
UNION ALL SELECT 7, '020      no unintended "authenticated-only" policies left',
  CASE WHEN (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'public'
               AND (coalesce(qual,'') LIKE '%uid() IS NOT NULL%'
                 OR coalesce(with_check,'') LIKE '%uid() IS NOT NULL%')
               AND NOT (tablename = 'audit_logs'       AND policyname = 'auth_insert')
               AND NOT (tablename = 'form_submissions' AND policyname = 'public_insert')) = 0
       THEN 'PASS' ELSE 'FAIL — see the detail query below' END

-- ── 020.6: recordings bucket (candidate PII) ────────────────────────────────
UNION ALL SELECT 8, '020      storage meeting-recordings policies gated',
  CASE WHEN (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'storage' AND tablename = 'objects'
               AND policyname IN ('rec_select','rec_insert','rec_update','rec_delete')
               AND (coalesce(qual,'') LIKE '%auth_is_approved%'
                 OR coalesce(with_check,'') LIKE '%auth_is_approved%')) = 4
       THEN 'PASS' ELSE 'FAIL' END

-- ── Safety: someone must still be able to approve people ────────────────────
UNION ALL SELECT 9, 'SAFETY   at least one approved, unlocked admin survives',
  CASE WHEN EXISTS (SELECT 1 FROM user_profiles
                    WHERE role = 'admin' AND status = 'active'
                      AND coalesce(is_locked, false) = false)
       THEN 'PASS' ELSE 'FAIL — nobody can approve anyone; see 020 header' END

)
SELECT check_name, result FROM checks ORDER BY ord;


-- ── Detail: anything still gated on bare authentication ─────────────────────
-- Expect exactly two rows: audit_logs/auth_insert and form_submissions/public_insert.
SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (coalesce(qual,'') LIKE '%uid() IS NOT NULL%'
     OR coalesce(with_check,'') LIKE '%uid() IS NOT NULL%')
 ORDER BY tablename, policyname;


-- ── Detail: who is currently locked out ─────────────────────────────────────
SELECT status, is_locked, count(*) AS users
  FROM user_profiles GROUP BY 1, 2 ORDER BY 1, 2;
