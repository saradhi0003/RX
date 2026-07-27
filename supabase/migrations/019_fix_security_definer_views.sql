-- 019_fix_security_definer_views.sql — close the Security Definer View gap
-- flagged by Supabase Advisor (3 CRITICAL findings).
--
-- Root cause: Postgres views run with the privileges of their CREATOR by
-- default, not the querying user — unless `security_invoker` is set. That
-- means these views bypass RLS on their base tables entirely.
--
-- Concretely: llm_usage has an admin-only read policy
-- ("llm_usage_read_admin" USING auth_is_admin()), but llm_usage_summary was
-- readable by ANY authenticated user — a real cost-data leak, not just lint
-- noise. job_view/company_view are lower-risk today (their base tables use
-- the open "authenticated_all" policy) but will matter once migration 012
-- (multi-tenancy) rewrites those to workspace-scoped policies.
--
-- Fix: flip each view to security_invoker so it re-checks RLS as the caller.
-- Safe to run anytime; no schema/data change, no dependency on 017/018.

ALTER VIEW job_view          SET (security_invoker = true);
ALTER VIEW company_view      SET (security_invoker = true);
ALTER VIEW llm_usage_summary SET (security_invoker = true);
