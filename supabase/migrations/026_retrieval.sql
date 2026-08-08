-- ═══════════════════════════════════════════════════════════════════════════
-- 026_retrieval.sql — hybrid retrieval corpus (pgvector + FTS) and the RPCs
--                     that Phase 2's retrieve → rerank → reason rewrite needs.
--
-- WHY
-- aiRecruiterMatchCandidates fetches candidates with
--   .eq("status","active").limit(max_candidates)      -- default 50
-- with NO ORDER BY and no relevance filter, then makes one LLM call per row.
-- On 738 active candidates that means it reasons over 50 rows in physical table
-- order and calls the best of those "the top match". That is a correctness bug
-- wearing a cost limit's clothing: the cap bounds spend, but the *selection* is
-- arbitrary. No amount of better reasoning recovers a candidate that was never
-- retrieved.
--
-- WHAT THE CORPUS ACTUALLY IS (verified live 2026-08-08, not inferred)
--   resumes                     0 rows  -- table is EMPTY
--   candidates                890 rows  (738 active)
--     with summary             61       (avg 3,589 chars — substantial)
--     with skills             546       (avg 69 skills)
--     with title              558
--     with resume_url         720       -- 718 are absolute Base44 URLs whose
--                                          files live outside this project
--   => 556 candidates carry embeddable text today.
--
-- So the corpus is candidate metadata, not resume prose. doc_chunks is
-- deliberately generic (source_table) so resumes and jobs slot in unchanged the
-- day their text lands, without a second table or a migration.
--
-- ⚠ Every identifier is schema-qualified. See the note in supabase/CLAUDE.md.
--
-- Apply AFTER 025. Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

SET LOCAL search_path = public, extensions, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pgvector. Supabase convention is to install extensions into `extensions`,
--    NOT public — which is exactly why every function below pins
--    `search_path = public, extensions, pg_temp`. 021's hardening pattern
--    (`public, pg_temp`) would make the `vector` type unresolvable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. doc_chunks — one embedded, full-text-indexed slice of a source row.
--
--    Dimension 768, not 1536:
--      • text-embedding-3-* supports Matryoshka truncation via `dimensions`,
--        so 768 costs ~1-2 MTEB points on a corpus this size — nothing.
--      • 768 is also nomic-embed-text's native dimension, so local Ollama dev
--        uses the SAME column with no mismatch. That is the deciding argument:
--        1536 would force either a second table or a broken offline path.
--      • Halves storage and HNSW graph size.
--
--    embedding_model is stored per row and filtered on in the RPC, so swapping
--    models later is a coexistence problem (backfill new, flip the parameter,
--    delete old) rather than downtime.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doc_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id),

  source_table    TEXT NOT NULL
                  CHECK (source_table IN ('candidates', 'resumes', 'jobs')),
  source_id       UUID NOT NULL,
  -- Denormalized so the match RPC never has to join through resumes to reach a
  -- candidate. Nullable because a job chunk has no candidate.
  candidate_id    UUID REFERENCES public.candidates(id) ON DELETE CASCADE,

  chunk_index     INT  NOT NULL DEFAULT 0,
  content         TEXT NOT NULL,
  -- Makes refresh idempotent: unchanged text re-chunks to identical hashes, the
  -- upsert no-ops, and no embedding is re-billed.
  content_hash    TEXT NOT NULL,
  token_estimate  INT  NOT NULL DEFAULT 0,

  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding       extensions.vector(768),
  embedding_stale BOOLEAN NOT NULL DEFAULT TRUE,

  fts tsvector GENERATED ALWAYS AS
      (to_tsvector('english', coalesce(content, ''))) STORED,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT doc_chunks_source_unique UNIQUE (source_table, source_id, chunk_index)
);

DROP TRIGGER IF EXISTS trg_doc_chunks_updated_at ON public.doc_chunks;
CREATE TRIGGER trg_doc_chunks_updated_at
  BEFORE UPDATE ON public.doc_chunks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_doc_chunks_stamp_ws ON public.doc_chunks;
CREATE TRIGGER trg_doc_chunks_stamp_ws
  BEFORE INSERT ON public.doc_chunks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace_id();

-- HNSW, not IVFFlat: IVFFlat trains list centroids on populated data, so it
-- builds badly on an empty table and needs a rebuild after every large
-- backfill. HNSW builds incrementally and is correct from row one — which
-- matters here, because this table starts empty.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON public.doc_chunks USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_chunks_fts       ON public.doc_chunks USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_source    ON public.doc_chunks (workspace_id, source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_candidate ON public.doc_chunks (workspace_id, candidate_id);
-- The backfill worklist.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_stale     ON public.doc_chunks (workspace_id) WHERE embedding_stale;

ALTER TABLE public.doc_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_all" ON public.doc_chunks;
CREATE POLICY "workspace_all" ON public.doc_chunks
  FOR ALL TO authenticated
  USING      (workspace_id = public.auth_workspace_id() AND public.auth_is_approved())
  WITH CHECK (workspace_id = public.auth_workspace_id() AND public.auth_is_approved());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FTS index on resumes.raw_text, ready for when resume text exists.
--    An EXPRESSION index, not a generated column: a generated `fts` column
--    rewrites the whole table and doubles the storage of the largest text field
--    in the schema. The expression index is planner-visible for the identical
--    to_tsvector(...) expression and costs nothing at write time beyond itself.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_resumes_raw_text_fts
  ON public.resumes USING GIN (to_tsvector('english', coalesce(raw_text, '')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Staleness marking.
--    A TRIGGER, not a flag set by parseResumeFile: candidate/resume text is
--    also written by CSV import, by the careers form and by hand in the SQL
--    editor. Anything that only fires from one code path silently drifts.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_doc_chunks_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.doc_chunks
     SET embedding_stale = TRUE
   WHERE source_table = TG_ARGV[0]
     AND source_id    = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_mark_stale ON public.candidates;
CREATE TRIGGER trg_candidates_mark_stale
  AFTER UPDATE OF summary, skills, title, notes, location ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.mark_doc_chunks_stale('candidates');

DROP TRIGGER IF EXISTS trg_resumes_mark_stale ON public.resumes;
CREATE TRIGGER trg_resumes_mark_stale
  AFTER UPDATE OF raw_text ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.mark_doc_chunks_stale('resumes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. llm_spend_today — replaces the unaggregated full-day row scan in
--    _shared/llm.ts (O(rows) over the wire, silently capped by PostgREST).
--    SECURITY INVOKER: it reads llm_usage, whose RLS already restricts to
--    workspace admins. A DEFINER version would be an RLS bypass with a public
--    URL — the exact 021 mistake.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.llm_spend_today(p_workspace_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(sum(cost_usd), 0)::numeric
    FROM public.llm_usage
   WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'utc')
     AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);
$$;

REVOKE ALL ON FUNCTION public.llm_spend_today(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.llm_spend_today(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. search_candidates_hybrid — the retrieval layer.
--
--    Three channels, fused by Reciprocal Rank Fusion:
--      kw     — chunk-level BM25 over doc_chunks.fts
--      vec    — chunk-level cosine over doc_chunks.embedding
--      struct — candidates.fts (the ONLY channel that sees title/skills with
--               the A/B weights migration 004 assigned them)
--
--    RRF rather than score normalization because BM25 and cosine live on
--    incomparable scales, and any normalization constant chosen today is wrong
--    for the next corpus. Ranks are scale-free. k=60 is the paper default.
--    A missing channel contributes 0, NOT 1/k — otherwise a candidate absent
--    from a channel scores better than one ranked last in it.
--
--    p_query_embedding is TEXT and cast internally: PostgREST cannot coerce a
--    JSON array into a `vector` parameter, so the pgvector literal string
--    '[0.01,-0.2,...]' is the only shape that survives /rest/v1/rpc/.
--    ⚠ Do not "fix" this to a vector parameter — it will 400 at the gateway.
--
--    SECURITY INVOKER + no anon EXECUTE: 021's lesson. p_workspace_id is an
--    explicit parameter because auth_workspace_id() returns NULL under the
--    service role (which Edge Functions use); for a user token, RLS on
--    doc_chunks/candidates remains the real boundary and the parameter is
--    redundant defence.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_candidates_hybrid(
  p_workspace_id    UUID,
  p_query           TEXT,
  p_query_embedding TEXT    DEFAULT NULL,
  p_embedding_model TEXT    DEFAULT 'text-embedding-3-small',
  p_required_skills TEXT[]  DEFAULT '{}',
  p_location        TEXT    DEFAULT NULL,
  p_exp_min         INT     DEFAULT NULL,
  p_exp_max         INT     DEFAULT NULL,
  p_statuses        TEXT[]  DEFAULT ARRAY['active'],
  p_limit           INT     DEFAULT 200,
  p_rrf_k           INT     DEFAULT 60,
  p_w_kw            REAL    DEFAULT 1.0,
  p_w_vec           REAL    DEFAULT 1.0,
  p_w_struct        REAL    DEFAULT 0.5
)
RETURNS TABLE (
  candidate_id       UUID,
  rrf_score          REAL,
  kw_rank            INT,
  vec_rank           INT,
  struct_rank        INT,
  evidence_chunk_ids UUID[],
  evidence_text      TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
WITH
ws AS (SELECT coalesce(p_workspace_id, public.auth_workspace_id()) AS id),

-- Hard filters FIRST, so the channels only ever rank a pre-narrowed set.
filtered AS (
  SELECT c.id, c.fts
    FROM public.candidates c, ws
   WHERE c.workspace_id = ws.id
     AND (p_statuses IS NULL OR c.status = ANY(p_statuses))
     AND (p_location IS NULL OR c.location ILIKE '%' || p_location || '%')
     AND (p_exp_min  IS NULL OR coalesce(c.experience_years, 0) >= p_exp_min)
     AND (p_exp_max  IS NULL OR coalesce(c.experience_years, 0) <= p_exp_max)
     -- && hits idx_candidates_skills (GIN, migration 004)
     AND (coalesce(array_length(p_required_skills, 1), 0) = 0
          OR c.skills && p_required_skills)
),

q AS (
  SELECT websearch_to_tsquery('english', coalesce(nullif(p_query, ''), 'x')) AS tsq,
         CASE WHEN p_query_embedding IS NULL OR p_query_embedding = ''
              THEN NULL
              ELSE p_query_embedding::extensions.vector(768)
         END AS emb
),

-- ── Channel 1: chunk-level BM25 ──────────────────────────────────────────────
-- Ranked in a subquery then collapsed with min(): a window function cannot be
-- nested inside an aggregate, and a candidate with several matching chunks must
-- contribute its BEST chunk's rank, not one row per chunk.
kw AS (
  SELECT candidate_id, min(rn)::int AS rnk
    FROM (
      SELECT ch.candidate_id,
             row_number() OVER (ORDER BY ts_rank_cd(ch.fts, q.tsq) DESC) AS rn
        FROM public.doc_chunks ch, q, ws
       WHERE ch.workspace_id = ws.id
         AND ch.candidate_id IN (SELECT id FROM filtered)
         AND ch.fts @@ q.tsq
       ORDER BY ts_rank_cd(ch.fts, q.tsq) DESC
       LIMIT greatest(p_limit * 4, 400)
    ) s
   GROUP BY candidate_id
),

-- ── Channel 2: chunk-level cosine ────────────────────────────────────────────
-- Over-fetch 4x: pgvector post-filters against the HNSW graph, so a narrow
-- WHERE plus a small LIMIT can under-return. Invisible at one workspace;
-- revisit at many.
vec AS (
  SELECT candidate_id, min(rn)::int AS rnk
    FROM (
      SELECT ch.candidate_id,
             row_number() OVER (ORDER BY ch.embedding <=> q.emb) AS rn
        FROM public.doc_chunks ch, q, ws
       WHERE q.emb IS NOT NULL
         AND ch.workspace_id = ws.id
         AND ch.embedding IS NOT NULL
         AND ch.embedding_model = p_embedding_model
         AND ch.candidate_id IN (SELECT id FROM filtered)
       ORDER BY ch.embedding <=> q.emb
       LIMIT greatest(p_limit * 4, 400)
    ) s
   GROUP BY candidate_id
),

-- ── Channel 3: structured (title/skills with 004's A/B weights) ──────────────
struct AS (
  SELECT f.id AS candidate_id,
         row_number() OVER (ORDER BY ts_rank_cd(f.fts, q.tsq) DESC)::int AS rnk
    FROM filtered f, q
   WHERE f.fts @@ q.tsq
),

fused AS (
  SELECT coalesce(kw.candidate_id, vec.candidate_id, struct.candidate_id) AS cid,
         kw.rnk AS kw_rank, vec.rnk AS vec_rank, struct.rnk AS struct_rank,
         (
           CASE WHEN kw.rnk     IS NULL THEN 0 ELSE p_w_kw     / (p_rrf_k + kw.rnk)     END +
           CASE WHEN vec.rnk    IS NULL THEN 0 ELSE p_w_vec    / (p_rrf_k + vec.rnk)    END +
           CASE WHEN struct.rnk IS NULL THEN 0 ELSE p_w_struct / (p_rrf_k + struct.rnk) END
         )::real AS rrf_score
    FROM kw
    FULL OUTER JOIN vec    ON vec.candidate_id    = kw.candidate_id
    FULL OUTER JOIN struct ON struct.candidate_id = coalesce(kw.candidate_id, vec.candidate_id)
)
SELECT f.cid,
       f.rrf_score,
       f.kw_rank,
       f.vec_rank,
       f.struct_rank,
       coalesce((SELECT array_agg(e.id ORDER BY e.chunk_index)
                   FROM (SELECT ch.id, ch.chunk_index FROM public.doc_chunks ch
                          WHERE ch.candidate_id = f.cid ORDER BY ch.chunk_index LIMIT 3) e),
                '{}')                                                   AS evidence_chunk_ids,
       coalesce((SELECT string_agg(e.content, E'\n---\n' ORDER BY e.chunk_index)
                   FROM (SELECT ch.content, ch.chunk_index FROM public.doc_chunks ch
                          WHERE ch.candidate_id = f.cid ORDER BY ch.chunk_index LIMIT 3) e),
                '')                                                     AS evidence_text
  FROM fused f
 WHERE f.cid IS NOT NULL
 ORDER BY f.rrf_score DESC
 LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.search_candidates_hybrid(
  UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, INT, INT, TEXT[], INT, INT, REAL, REAL, REAL
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_candidates_hybrid(
  UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, INT, INT, TEXT[], INT, INT, REAL, REAL, REAL
) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. candidate_match_results — retrieval provenance.
--    Added here so Phase 2 (the function rewrite) needs no migration of its own.
--    Persisting rank/score for every retrieved candidate, not just the reasoned
--    ones, is what lets a recruiter see who was considered and why they were cut.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.candidate_match_results
  ADD COLUMN IF NOT EXISTS evidence            JSONB,
  ADD COLUMN IF NOT EXISTS retrieval_rank      INT,
  ADD COLUMN IF NOT EXISTS retrieval_score     REAL,
  ADD COLUMN IF NOT EXISTS deterministic_score INT;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify with scripts/verify_026_retrieval.sql (all rows must read PASS), then
-- backfill:  POST /functions/v1/embedDocuments  {"source_table":"candidates"}
-- repeatedly until it returns {"remaining": 0}.
-- ─────────────────────────────────────────────────────────────────────────────
