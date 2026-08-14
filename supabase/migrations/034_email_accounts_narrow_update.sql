-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 034: narrow the UPDATE grant on email_accounts to `is_active`.
--
-- 033 revoked anon outright and pinned SELECT to the nine non-secret columns,
-- but left `authenticated` holding table-wide UPDATE — verified on the live
-- project immediately after applying it: UPDATE covered all 15 columns,
-- access_token and refresh_token included.
--
-- That is not a confidentiality hole. Postgres requires column-level SELECT to
-- *read* a column in any expression, so `SET last_error = access_token` is
-- refused, and PostgREST's `UPDATE ... RETURNING` can only return the columns
-- SELECT was granted on. The tokens cannot be exfiltrated through it.
--
-- It is an integrity hole: a workspace admin could overwrite a token with
-- garbage and silently break polling for that mailbox, with the failure
-- surfacing later and elsewhere (last_error on a poll run) — the kind of
-- breakage that is expensive to trace back to its cause.
--
-- The UI's only legitimate write is flipping is_active to disconnect a mailbox.
-- Every other write to this table comes from the OAuth callback or the poller,
-- which run as the service role and bypass grants entirely. So the grant that
-- matches actual usage is exactly one column.
--
-- The set_updated_at() trigger still maintains updated_at: column privileges
-- are checked against the columns named in the statement, not those a trigger
-- assigns.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE UPDATE ON email_accounts FROM authenticated;
GRANT UPDATE (is_active) ON email_accounts TO authenticated;
