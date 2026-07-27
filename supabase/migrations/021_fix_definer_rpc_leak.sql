-- ═══════════════════════════════════════════════════════════════════════════
-- 021_fix_definer_rpc_leak.sql — close a live PII leak + Advisor hardening
--
-- ⚠ THE LEAK (found by Supabase Advisor + confirmed against production
--   2026-07-27): search_candidates() and search_jobs() were declared
--   SECURITY DEFINER, so they ran as the function owner and **bypassed RLS
--   entirely**. Both are exposed over PostgREST as /rest/v1/rpc/<name>, and
--   `anon` had EXECUTE. With nothing but the public anon key — which is baked
--   into the browser bundle by design — anyone could run:
--
--     curl -X POST $URL/rest/v1/rpc/search_candidates \
--       -H "apikey: $ANON_KEY" -d '{"query":"engineer"}'
--
--   and get 50 candidate records back: full_name, email, phone, location,
--   title. Different search terms paginate the whole table (890 candidates,
--   276 jobs at time of writing). Migration 020 did NOT close this — 020 fixed
--   the RLS policies, and SECURITY DEFINER is precisely what ignores them.
--
--   Fix: flip both to SECURITY INVOKER so they run as the caller and inherit
--   the `auth_is_approved()` policy from 020, and revoke anon's EXECUTE.
--   Approved users still get results; anon and unapproved users get zero rows.
--
-- Also addresses the remaining Advisor WARNs: mutable search_path on
-- SECURITY DEFINER functions, and trigger-only functions being callable as RPC.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE LEAK — make the search RPCs respect RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.search_candidates(text) SECURITY INVOKER;
ALTER FUNCTION public.search_jobs(text)       SECURITY INVOKER;

-- Belt and braces: the anon role has no business calling these at all.
REVOKE EXECUTE ON FUNCTION public.search_candidates(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_jobs(text)       FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pin search_path on SECURITY DEFINER functions.
--    An unpinned search_path on a DEFINER function lets a caller who can create
--    objects shadow a table/function name and have it run with owner rights.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.audit_entity_change()          SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_recruiter_from_profile()  SET search_path = public, pg_temp;
ALTER FUNCTION public.search_candidates(text)        SET search_path = public, pg_temp;
ALTER FUNCTION public.search_jobs(text)              SET search_path = public, pg_temp;

-- Not SECURITY DEFINER, but free hardening and silences the Advisor.
ALTER FUNCTION public.set_updated_at()        SET search_path = public, pg_temp;
ALTER FUNCTION public.bookings_default_room() SET search_path = public, pg_temp;

-- NOTE: public.immutable_array_to_string is deliberately left alone. It is used
-- in an expression index; adding a SET clause makes a function non-inlinable,
-- and it is neither SECURITY DEFINER nor data-returning, so the warning is
-- noise here. Revisit only alongside an index rebuild.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger-only functions should not be callable over the REST API.
--    Postgres checks EXECUTE at CREATE TRIGGER time, not at fire time, so
--    revoking here does NOT stop the triggers from running.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.audit_entity_change()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_recruiter_from_profile()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_default_room()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_user_profile_privileges() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()               FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ⚠ DO NOT revoke EXECUTE on auth_is_approved() / auth_is_admin().
--    The Advisor flags them as "SECURITY DEFINER executable by anon", but they
--    are compiled into every RLS policy from 020, and RLS policy expressions
--    are evaluated with the *caller's* privileges. Revoking EXECUTE would make
--    every query against a gated table fail with "permission denied for
--    function auth_is_approved". `anon` needs it too: the blog_posts policy is
--    `status = 'published' OR auth_is_approved()`, evaluated for logged-out
--    visitors on the public marketing pages.
--
--    They are safe to expose: both take no arguments, read only the caller's
--    own row via auth.uid(), and return a single boolean. For an anonymous
--    caller they simply return false.
-- ─────────────────────────────────────────────────────────────────────────────

-- form_submissions/public_insert keeps `WITH CHECK (true)` on purpose — the
-- public careers form must accept submissions from logged-out visitors. Reads
-- are gated by auth_is_approved() (020). Advisor flags it; it is intended.

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Must both report is_definer = false:
SELECT proname, prosecdef AS is_definer,
       array_to_string(coalesce(proconfig, '{}'), ',') AS config
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND proname IN ('search_candidates', 'search_jobs');

-- And from a shell, with ONLY the anon key — must return [] now, not 50 rows:
--   curl -s -X POST "$URL/rest/v1/rpc/search_candidates" \
--     -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--     -d '{"query":"engineer"}'
