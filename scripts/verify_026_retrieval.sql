-- ═══════════════════════════════════════════════════════════════════════════
-- verify_026_retrieval.sql — confirm migration 026 actually landed.
-- Read-only. Paste into the Supabase SQL editor and run; every row should PASS.
--
-- 026 adds pgvector, doc_chunks, the hybrid retrieval RPC, llm_spend_today and
-- retrieval provenance columns on candidate_match_results.
--
-- ⚠ Every identifier is schema-qualified — see supabase/CLAUDE.md.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path = public, extensions, pg_catalog;

WITH checks AS (

SELECT 1 AS ord, '026  vector extension installed' AS check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
       THEN 'PASS (schema=' || (SELECT n.nspname FROM pg_extension e
              JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname='vector') || ')'
       ELSE 'FAIL - CREATE EXTENSION vector WITH SCHEMA extensions' END AS result

UNION ALL SELECT 2, '026  doc_chunks exists, workspace_id NOT NULL',
  CASE WHEN (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='public' AND table_name='doc_chunks'
               AND column_name='workspace_id' AND is_nullable='NO') = 1
       THEN 'PASS' ELSE 'FAIL' END

-- HNSW, not IVFFlat: IVFFlat trains centroids on populated data and builds
-- badly on an empty table. This one starts empty.
UNION ALL SELECT 3, '026  HNSW cosine index present',
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                    AND indexname='idx_doc_chunks_embedding'
                    AND indexdef ILIKE '%hnsw%' AND indexdef ILIKE '%vector_cosine_ops%')
       THEN 'PASS' ELSE 'FAIL' END

-- 021's lesson: a SECURITY DEFINER function that returns table rows is an RLS
-- bypass with a public URL.
UNION ALL SELECT 4, '026  search_candidates_hybrid is SECURITY INVOKER',
  CASE WHEN (SELECT NOT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='search_candidates_hybrid')
       THEN 'PASS' ELSE 'FAIL - RLS bypass with a public URL' END

-- Supabase installs extensions into `extensions`; 021's usual `public, pg_temp`
-- pin would make the `vector` type unresolvable inside this function.
UNION ALL SELECT 5, '026  hybrid RPC search_path includes extensions',
  CASE WHEN (SELECT array_to_string(coalesce(p.proconfig,'{}'), ',') FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='search_candidates_hybrid') ILIKE '%extensions%'
       THEN 'PASS' ELSE 'FAIL - the vector type will not resolve' END

UNION ALL SELECT 6, '026  anon cannot EXECUTE either new RPC',
  CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                        WHERE n.nspname='public'
                          AND p.proname IN ('search_candidates_hybrid','llm_spend_today')
                          AND has_function_privilege('anon', p.oid, 'EXECUTE'))
       THEN 'PASS' ELSE 'FAIL - exposed at /rest/v1/rpc/' END

UNION ALL SELECT 7, '026  doc_chunks policy scopes workspace + approval',
  CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='doc_chunks'
               AND coalesce(qual,'') LIKE '%auth_workspace_id%'
               AND coalesce(qual,'') LIKE '%auth_is_approved%') = 1
       THEN 'PASS' ELSE 'FAIL' END

UNION ALL SELECT 8, '026  resumes.raw_text FTS expression index',
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                    AND indexname='idx_resumes_raw_text_fts')
       THEN 'PASS' ELSE 'FAIL' END

UNION ALL SELECT 9, '026  llm_spend_today callable',
  CASE WHEN public.llm_spend_today('00000000-0000-0000-0000-000000000001') >= 0
       THEN 'PASS (today=$' || public.llm_spend_today('00000000-0000-0000-0000-000000000001')::text || ')'
       ELSE 'FAIL' END

UNION ALL SELECT 10, '026  candidate_match_results has retrieval provenance',
  CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
               AND table_name='candidate_match_results'
               AND column_name IN ('evidence','retrieval_rank','retrieval_score','deterministic_score')) = 4
       THEN 'PASS' ELSE 'FAIL' END

UNION ALL SELECT 11, '026  staleness triggers installed',
  CASE WHEN (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             WHERE NOT t.tgisinternal
               AND t.tgname IN ('trg_candidates_mark_stale','trg_resumes_mark_stale')) = 2
       THEN 'PASS' ELSE 'FAIL' END

-- The degradation guarantee: with doc_chunks empty, the kw and vec channels
-- contribute nothing and the RPC must still return the structured ranking
-- rather than an empty set. This is what makes 026 safe to ship before any
-- backfill has run.
UNION ALL SELECT 12, '026  RPC still ranks with the vector index empty',
  CASE WHEN (SELECT count(*) FROM public.search_candidates_hybrid(
               '00000000-0000-0000-0000-000000000001', 'senior react engineer', NULL,
               'text-embedding-3-small', '{}', NULL, NULL, NULL, ARRAY['active'], 10)) > 0
       THEN 'PASS - degrades to the structured channel' ELSE 'FAIL' END

-- RRF math, asserted against the function that actually runs rather than a
-- reimplementation in another language. With only the structured channel
-- present, the top row must score exactly p_w_struct / (p_rrf_k + 1).
-- A missing channel must contribute 0, NOT 1/k — otherwise a candidate absent
-- from a channel outranks one placed last in it.
UNION ALL SELECT 13, '026  RRF: missing channels contribute 0, not 1/k',
  CASE WHEN abs(
         (SELECT rrf_score FROM public.search_candidates_hybrid(
            '00000000-0000-0000-0000-000000000001', 'senior react engineer', NULL,
            'text-embedding-3-small', '{}', NULL, NULL, NULL, ARRAY['active'], 1)
          LIMIT 1)
         - (0.5 / (60 + 1))
       ) < 0.00001
       THEN 'PASS' ELSE 'FAIL - fusion weights or null-handling drifted' END

-- Informational, not a failure: a backlog just means the embedding queue has
-- not been drained yet.
UNION ALL SELECT 14, '026  embedding coverage (informational)',
  'chunks=' || (SELECT count(*)::text FROM public.doc_chunks) ||
  ' embedded=' || (SELECT count(*)::text FROM public.doc_chunks WHERE embedding IS NOT NULL) ||
  ' stale=' || (SELECT count(*)::text FROM public.doc_chunks WHERE embedding_stale)

)
SELECT check_name, result FROM checks ORDER BY ord;
