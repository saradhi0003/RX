import { createEntity } from "@/lib/entityFactory";

/**
 * Connected Gmail / Zoho mailboxes (migration 032).
 *
 * The select list is explicit and must stay that way. 032 revokes table-wide
 * SELECT from `authenticated` and grants only these columns, so the OAuth
 * tokens (`access_token`, `refresh_token`) are unreadable from the browser —
 * and a `SELECT *` is rejected outright rather than silently trimmed, which
 * would break every read on this page.
 *
 * Writes still go through the service role (emailOAuthCallback, the poller);
 * the only write the UI does is flipping `is_active` to disconnect.
 */
export const EmailAccount = createEntity("email_accounts", {
  columns:
    "id, workspace_id, provider, email_address, is_active, last_polled_at, last_error, created_at, updated_at",
});
