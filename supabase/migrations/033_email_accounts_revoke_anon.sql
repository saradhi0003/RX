-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: close the anon grant on email_accounts.
--
-- 032 tightened SELECT down to the non-secret columns, but only for the
-- `authenticated` role:
--
--     REVOKE SELECT ON email_accounts FROM authenticated;
--     GRANT  SELECT (id, workspace_id, ...) ON email_accounts TO authenticated;
--
-- Supabase's default privileges grant new public-schema tables to BOTH `anon`
-- and `authenticated`, so `anon` kept table-wide SELECT — including
-- access_token and refresh_token. Verified on the live project 2026-08-14:
-- anon could select all 15 columns, authenticated only the intended 9.
--
-- This is not a live leak today: RLS is enabled and the sole policy is
-- FOR ALL TO authenticated, so an anon request matches no policy and returns
-- zero rows. It is a latent one — the grant is the thing standing between a
-- future anon-readable policy (the `blog_posts` public policy is the precedent
-- in this schema) and publishing OAuth refresh tokens to anyone holding the
-- publishable key, which ships in the browser bundle by design.
--
-- Defence in depth: RLS decides which ROWS, grants decide which COLUMNS, and a
-- table holding third-party credentials should be unreadable to anon on both
-- counts. Nothing anonymous has any business reading a connected mailbox.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON email_accounts FROM anon;

-- The write side of the same argument: browsers never insert or delete these
-- rows (the OAuth callback and poller run as the service role, which bypasses
-- both RLS and grants). The UI's only write is flipping is_active to
-- disconnect, so authenticated keeps UPDATE and nothing else.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON email_accounts FROM authenticated;

-- Re-assert 032's intent so this migration is self-contained and re-runnable:
-- SELECT stays restricted to the non-secret columns. Never add access_token,
-- refresh_token, token_expires_at, history_cursor or external_account_id here.
REVOKE SELECT ON email_accounts FROM authenticated;
GRANT SELECT (id, workspace_id, provider, email_address, is_active,
              last_polled_at, last_error, created_at, updated_at)
  ON email_accounts TO authenticated;
