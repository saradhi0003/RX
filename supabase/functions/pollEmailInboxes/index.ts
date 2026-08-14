// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or npm: imports.
/**
 * pollEmailInboxes
 * POST {} — invoked by a Supabase scheduled trigger every ~5 minutes.
 *
 * For each connected mailbox (email_accounts): refresh the OAuth token when
 * due, list messages newer than the account cursor, normalize them into
 * inbound_emails, extract resume-attachment text, and hand each row to
 * _shared/emailProcessor.ts — the same intake path the Postmark webhook uses.
 *
 * Auth: x-cron-secret header (same pattern as scheduledFollowupRun).
 * One account's failure never aborts the others — it lands in last_error.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import {
  hasCronSecret, getCronSecret,
  getGoogleOAuthEnv, getZohoOAuthEnv,
} from "../_shared/env.ts";
import {
  normalizeGmailMessage,
  normalizeZohoMessage,
  isParseableAttachment,
} from "../_shared/emailNormalizers.ts";
import { attachmentsToText, MAX_ATTACHMENTS_PER_EMAIL } from "../_shared/attachmentText.ts";
import { processInboundEmail } from "../_shared/emailProcessor.ts";

/**
 * How many messages one run will fully process (fetch + classify + parse).
 * Bounded by the Edge Function time limit, not by how much mail is waiting.
 */
const MAX_MESSAGES_PER_ACCOUNT = 20;
/**
 * How many message stubs to *list*. Larger than the processing cap on purpose:
 * both providers list newest-first, so seeing more of the queue is what lets a
 * run pick the OLDEST unprocessed messages. Processing the newest 20 and then
 * moving the cursor past everything would strand any backlog bigger than the
 * cap permanently.
 */
const LIST_PAGE_SIZE = 100;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/* ── OAuth token refresh ─────────────────────────────────────────────────── */

async function refreshTokenIfDue(account) {
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
  if (expiresAt - REFRESH_MARGIN_MS > Date.now()) return account.access_token;
  if (!account.refresh_token) throw new Error("token expired and no refresh_token stored");

  const tokenUrl = account.provider === "gmail"
    ? "https://oauth2.googleapis.com/token"
    : "https://accounts.zoho.com/oauth/v2/token";
  const { clientId, clientSecret } =
    account.provider === "gmail" ? getGoogleOAuthEnv() : getZohoOAuthEnv();

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `token refresh failed: HTTP ${res.status}`);
  }

  await supabase.from("email_accounts").update({
    access_token: json.access_token,
    token_expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  }).eq("id", account.id);

  return json.access_token;
}

/* ── Insert helpers ──────────────────────────────────────────────────────── */

// The service role bypasses RLS *and* the workspace_id stamp trigger, so the
// mailbox's own workspace has to be carried in explicitly.
//
// There is deliberately no DEFAULT_WORKSPACE_ID fallback: 032 leaves
// email_accounts.workspace_id nullable, and defaulting a null would file one
// tenant's mail into another's workspace — a silent, hard-to-notice data leak.
// Failing instead surfaces as last_error on that one account and leaves the
// other mailboxes polling normally.
async function insertIfNew(normalized, workspaceId) {
  if (!workspaceId) {
    throw new Error(
      "mailbox has no workspace_id — reconnect it so inbound mail is scoped to a workspace",
    );
  }

  const { data: existing } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("message_id", normalized.message_id)
    .maybeSingle();
  if (existing) return null;

  const { data, error } = await supabase
    .from("inbound_emails")
    .insert({
      ...normalized,
      workspace_id: workspaceId,
      processing_status: "pending",
    })
    .select("id")
    .single();

  // The check above is not atomic — two overlapping cron runs can both pass it.
  // `inbound_emails.message_id` is UNIQUE, so the loser gets 23505; that is the
  // dedupe working, not an error, and throwing here would abort the whole
  // account's poll and discard its cursor.
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`insert inbound_emails failed: ${error.message}`);
  }
  return data.id;
}

/**
 * Resume attachments → plain text for the classifier and parser.
 *
 * The two providers differ only in how the bytes are fetched, so the caller
 * passes a `download` closure and everything else (which attachments are worth
 * fetching, the per-email cap, extraction) stays in one place.
 */
async function extractAttachmentText(attachments, download) {
  const parseable = (attachments || []).filter((a) =>
    isParseableAttachment(a.name, a.contentType)
  );
  if (!parseable.length) return "";

  const files = [];
  for (const att of parseable.slice(0, MAX_ATTACHMENTS_PER_EMAIL)) {
    try {
      const bytes = await download(att);
      if (bytes) files.push({ name: att.name, bytes });
    } catch {
      // A single unreachable attachment must not fail the whole email.
    }
  }
  return files.length ? await attachmentsToText(files) : "";
}

/* ── Gmail ─────────────────────────────────────────────────────────────── */

async function pollGmail(account, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

  // Cursor = max internalDate (ms) seen so far. Gmail's after: takes seconds.
  const after = account.history_cursor
    ? ` after:${Math.floor(Number(account.history_cursor) / 1000)}`
    : "";
  const listUrl = `${base}?q=${encodeURIComponent(`in:inbox${after}`)}&maxResults=${LIST_PAGE_SIZE}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`Gmail list failed: HTTP ${listRes.status}`);
  const list = await listRes.json();

  let imported = 0;
  let maxInternalDate = Number(account.history_cursor || 0);

  // Gmail lists newest-first. Reverse to take the OLDEST unprocessed messages,
  // so the cursor only ever moves over mail this run actually handled and the
  // remainder of a backlog is still waiting (not skipped) on the next run.
  const stubs = [...(list.messages || [])].reverse().slice(0, MAX_MESSAGES_PER_ACCOUNT);

  for (const stub of stubs) {
    try {
      const msgRes = await fetch(`${base}/${stub.id}?format=full`, { headers });
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      const normalized = normalizeGmailMessage(msg, account.id);
      const emailId = await insertIfNew(normalized, account.workspace_id);

      if (emailId) {
        const extraText = await extractAttachmentText(normalized.attachments, async (att) => {
          const attRes = await fetch(`${base}/${stub.id}/attachments/${att.attachmentId}`, { headers });
          if (!attRes.ok) return null;
          const attJson = await attRes.json();
          if (!attJson?.data) return null;
          const b64 = attJson.data.replace(/-/g, "+").replace(/_/g, "/");
          return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        });

        await processInboundEmail(emailId, { extraText });
        imported++;
      }

      // Only after the message is stored (or was already stored) — advancing
      // past one we failed to fetch would drop it for good.
      maxInternalDate = Math.max(maxInternalDate, Number(msg.internalDate || 0));
    } catch (e) {
      // One unreadable message must not abort the account and lose the cursor.
      console.error(`[pollEmailInboxes] gmail message ${stub.id} failed:`, e);
    }
  }

  return { imported, cursor: String(maxInternalDate || account.history_cursor || "") };
}

/* ── Zoho ──────────────────────────────────────────────────────────────── */

async function pollZoho(account, accessToken) {
  if (!account.external_account_id) {
    throw new Error("Zoho account id missing — reconnect the mailbox");
  }
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
  const base = `https://mail.zoho.com/api/accounts/${account.external_account_id}/messages`;

  const listRes = await fetch(`${base}/view?limit=${LIST_PAGE_SIZE}&sortorder=false`, { headers });
  if (!listRes.ok) throw new Error(`Zoho list failed: HTTP ${listRes.status}`);
  const list = await listRes.json();

  const cursorMs = Number(account.history_cursor || 0);
  let imported = 0;
  let maxReceived = cursorMs;

  // Same reasoning as Gmail: keep only what is newer than the cursor, then work
  // oldest-first so a backlog larger than the per-run cap is drained across
  // runs instead of being jumped over.
  const stubs = (list.data || [])
    .filter((s) => Number(s.receivedTime || 0) > cursorMs)
    .sort((a, b) => Number(a.receivedTime || 0) - Number(b.receivedTime || 0))
    .slice(0, MAX_MESSAGES_PER_ACCOUNT);

  for (const stub of stubs) {
    const receivedMs = Number(stub.receivedTime || 0);
    try {
      // Body HTML lives behind a separate content endpoint.
      let contentHtml = "";
      const contentRes = await fetch(`${base}/${stub.messageId}/content`, { headers });
      if (contentRes.ok) {
        const contentJson = await contentRes.json().catch(() => ({}));
        contentHtml = contentJson?.data?.content || "";
      }

      const normalized = normalizeZohoMessage(stub, contentHtml, account.id);
      const emailId = await insertIfNew(normalized, account.workspace_id);

      if (emailId) {
        const extraText = await extractAttachmentText(normalized.attachments, async (att) => {
          const attRes = await fetch(`${base}/${stub.messageId}/attachments/${att.attachmentId}`, { headers });
          return attRes.ok ? new Uint8Array(await attRes.arrayBuffer()) : null;
        });

        await processInboundEmail(emailId, { extraText });
        imported++;
      }

      maxReceived = Math.max(maxReceived, receivedMs);
    } catch (e) {
      console.error(`[pollEmailInboxes] zoho message ${stub.messageId} failed:`, e);
    }
  }

  return { imported, cursor: String(maxReceived || cursorMs) };
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

Deno.serve(withErrorHandling(async (req) => {
  if (hasCronSecret()) {
    if (req.headers.get("x-cron-secret") !== getCronSecret()) {
      return errResponse("Unauthorized: bad or missing x-cron-secret", 401);
    }
  } else {
    console.warn("CRON_SECRET not set — cron gate disabled (dev only; set it in production)");
  }

  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("id, workspace_id, provider, email_address, access_token, refresh_token, token_expires_at, history_cursor, external_account_id")
    .eq("is_active", true);

  if (error) return errResponse(error.message, 500);
  if (!accounts?.length) return okResponse({ polled: 0, imported: 0, message: "No connected mailboxes" });

  const results = [];
  for (const account of accounts) {
    try {
      const token = await refreshTokenIfDue(account);
      const outcome = account.provider === "gmail"
        ? await pollGmail(account, token)
        : await pollZoho(account, token);

      await supabase.from("email_accounts").update({
        history_cursor: outcome.cursor,
        last_polled_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", account.id);

      results.push({ account: account.email_address, provider: account.provider, imported: outcome.imported, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase.from("email_accounts").update({ last_error: message }).eq("id", account.id);
      results.push({ account: account.email_address, provider: account.provider, ok: false, error: message });
    }
  }

  return okResponse({
    polled: accounts.length,
    imported: results.reduce((s, r) => s + (r.imported || 0), 0),
    results,
  });
}));
