// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or npm: imports.
/**
 * botIngest  (verify_jwt = false)
 *
 * POST — one email that an external bot (a scheduled Grok routine, a script,
 *        an MCP agent reading Zoho/Gmail) fetched and wants loaded.
 * GET  ?source=&message_id= — where that message got to (status lookup).
 *
 * Third entry point into the same intake path as inboundEmailWebhook and
 * pollEmailInboxes: store the row, then hand it to _shared/emailProcessor.ts
 * (classify → Job / Candidate / approval_items / ignored). Nothing here
 * classifies or parses — that would be a second copy of the pipeline.
 *
 * Auth: `x-webhook-secret` must equal the BOT_WEBHOOK_SECRET Edge secret.
 * Fails CLOSED when the secret is unset — unlike the cron gate there is no dev
 * convenience in an open endpoint that turns arbitrary mail into records.
 *
 * Contract (payload, responses, limits): docs/BOT_INGEST.md.
 * Validation and the row shape: _shared/botIngestContract.ts (unit-tested).
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { DEFAULT_WORKSPACE_ID } from "../_shared/auth.ts";
import { hasBotWebhookSecret, getBotWebhookSecret, getBotIngestMaxPerMinute } from "../_shared/env.ts";
import { attachmentsToText, MAX_ATTACHMENTS_PER_EMAIL } from "../_shared/attachmentText.ts";
import { processInboundEmail } from "../_shared/emailProcessor.ts";
import {
  BOT_INGEST_SOURCES,
  DEFAULT_MAX_PER_MINUTE,
  MAX_REQUEST_BYTES,
  buildInboundEmailRow,
  parseableFiles,
  secretsMatch,
  storedMessageId,
  validateBotIngestPayload,
} from "../_shared/botIngestContract.ts";

const MIGRATION_HINT =
  "inbound_emails is missing the provenance columns — apply supabase/migrations/036_inbound_email_provenance.sql";

/** PostgREST/Postgres errors meaning 036 hasn't been applied yet. */
function isMissingColumn(err) {
  return err?.code === "PGRST204" || err?.code === "42703";
}

/**
 * Which workspace the message belongs to.
 *
 * `connection_id` (an email_accounts row) wins, because a connected mailbox
 * already knows its workspace. As in the poller there is no DEFAULT fallback
 * for a mailbox with a NULL workspace — that would file one tenant's mail
 * under another's. With neither field the message lands in the default
 * workspace, like the Postmark stream does.
 */
async function resolveWorkspace(p) {
  if (p.connection_id) {
    const { data: account, error } = await supabase
      .from("email_accounts")
      .select("id, workspace_id, provider, is_active")
      .eq("id", p.connection_id)
      .maybeSingle();
    if (error) throw new Error(`email_accounts lookup failed: ${error.message}`);
    if (!account) return { error: "connection_id does not match a connected mailbox", status: 400 };
    if (!account.is_active) {
      return { error: "that mailbox was disconnected in Email Settings — not importing its mail", status: 409 };
    }
    if (!account.workspace_id) {
      return { error: "that mailbox has no workspace_id — reconnect it in Email Settings", status: 409 };
    }
    if (p.workspace_id && p.workspace_id !== account.workspace_id) {
      return { error: "workspace_id does not match the connection's workspace", status: 400 };
    }
    if (p.source !== "bot" && p.source !== account.provider) {
      return { error: `source '${p.source}' does not match the connection's provider '${account.provider}'`, status: 400 };
    }
    return { workspaceId: account.workspace_id, emailAccountId: account.id };
  }

  if (p.workspace_id) {
    const { data: ws, error } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", p.workspace_id)
      .maybeSingle();
    if (error) throw new Error(`workspaces lookup failed: ${error.message}`);
    if (!ws) return { error: "workspace_id does not match a workspace", status: 400 };
    return { workspaceId: ws.id, emailAccountId: null };
  }

  return { workspaceId: DEFAULT_WORKSPACE_ID, emailAccountId: null };
}

async function findByMessageId(messageId: string) {
  const { data, error } = await supabase
    .from("inbound_emails")
    .select("id, processing_status, classification, classification_confidence, resulting_entity_type, resulting_entity_id, error_message")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw new Error(`inbound_emails lookup failed: ${error.message}`);
  return data;
}

async function handleStatus(url: URL) {
  const source = url.searchParams.get("source") || "";
  const messageId = (url.searchParams.get("message_id") || "").trim();
  if (!(BOT_INGEST_SOURCES as readonly string[]).includes(source) || !messageId) {
    return errResponse(`GET needs ?source=${BOT_INGEST_SOURCES.join("|")}&message_id=<id>`, 400);
  }
  const row = await findByMessageId(storedMessageId(source, messageId));
  if (!row) return okResponse({ status: "not_found", message_id: messageId }, 404);
  return okResponse({
    status: row.processing_status,
    id: row.id,
    message_id: messageId,
    classification: row.classification,
    confidence: row.classification_confidence,
    entity_type: row.resulting_entity_type,
    entity_id: row.resulting_entity_id,
    error: row.error_message,
  });
}

/** Messages accepted through this endpoint in the last minute, across all bots. */
async function recentBotIngests(): Promise<{ count: number; error?: unknown }> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .eq("ingest_channel", "bot_ingest")
    .gte("created_at", since);
  return { count: count ?? 0, error };
}

Deno.serve(withErrorHandling(async (req) => {
  if (!hasBotWebhookSecret()) {
    return errResponse("botIngest is not configured: set the BOT_WEBHOOK_SECRET Edge Function secret", 503);
  }
  if (!secretsMatch(req.headers.get("x-webhook-secret"), getBotWebhookSecret())) {
    return errResponse("Unauthorized: bad or missing x-webhook-secret", 401);
  }

  if (req.method === "GET") return await handleStatus(new URL(req.url));
  if (req.method !== "POST") return errResponse("Method not allowed — POST a message or GET its status", 405);

  // Content-Length first so an oversized upload is refused before it is read;
  // the length check after covers chunked bodies, which carry no header.
  if (Number(req.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
    return errResponse(`Request body exceeds ${MAX_REQUEST_BYTES} bytes`, 413);
  }
  const text = await req.text();
  if (text.length > MAX_REQUEST_BYTES) {
    return errResponse(`Request body exceeds ${MAX_REQUEST_BYTES} bytes`, 413);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return errResponse("Body is not valid JSON", 400);
  }

  const result = validateBotIngestPayload(body);
  if (!result.ok) {
    return okResponse({ error: "Invalid payload", errors: result.errors }, 400);
  }
  const p = result.value;

  // Dedupe before the rate check, so a bot replaying a backlog it already
  // delivered gets cheap "duplicate" answers instead of being throttled.
  const messageId = storedMessageId(p.source, p.message_id);
  const existing = await findByMessageId(messageId);
  if (existing) {
    return okResponse({
      status: "duplicate",
      id: existing.id,
      message_id: p.message_id,
      processing_status: existing.processing_status,
    });
  }

  const ws = await resolveWorkspace(p);
  if (ws.error) return errResponse(ws.error, ws.status);

  // A runaway bot loop would otherwise flood the table and the LLM queue. The
  // daily LLM cost ceiling still caps spend; this caps volume. A failed count
  // read is not a reason to drop mail — the cost ceiling still holds — except
  // when it means 036 is missing, which the insert would hit anyway.
  const perMinute = getBotIngestMaxPerMinute(DEFAULT_MAX_PER_MINUTE);
  if (perMinute > 0) {
    const recent = await recentBotIngests();
    if (isMissingColumn(recent.error)) return errResponse(MIGRATION_HINT, 503);
    if (recent.error) console.warn("[botIngest] rate check failed, allowing:", recent.error);
    if (recent.count >= perMinute) {
      const res = okResponse(
        { error: `Rate limit: ${perMinute} messages per minute`, retry_after_seconds: 60 },
        429,
      );
      res.headers.set("Retry-After", "60");
      return res;
    }
  }

  // Extract resume text now, before the row exists, rather than in the
  // background: the bytes are only in this request, and stashing the text at
  // insert time means the row is complete — reprocessable — the moment it is
  // durable. A PDF/DOCX takes a second or two; a bot can wait for that.
  const files = parseableFiles(p.files, MAX_ATTACHMENTS_PER_EMAIL);
  const attachmentText = files.length
    ? await attachmentsToText(files.map((f) => ({ name: f.name, bytes: f.bytes })))
    : "";

  const row = buildInboundEmailRow(p, {
    workspaceId: ws.workspaceId,
    emailAccountId: ws.emailAccountId,
    attachmentText,
  });
  const { data: email, error: insertErr } = await supabase
    .from("inbound_emails")
    .insert(row)
    .select("id")
    .single();

  if (insertErr) {
    // Two deliveries of the same message raced past the lookup above;
    // message_id is UNIQUE, so the loser lands here. That's the dedupe working.
    if (insertErr.code === "23505") {
      const dup = await findByMessageId(messageId);
      return okResponse({
        status: "duplicate",
        id: dup?.id ?? null,
        message_id: p.message_id,
        processing_status: dup?.processing_status ?? null,
      });
    }
    if (isMissingColumn(insertErr)) return errResponse(MIGRATION_HINT, 503);
    throw new Error(`insert inbound_emails failed: ${insertErr.message}`);
  }

  // Classify → route → create records, exactly as for Postmark and the poller.
  // processInboundEmail never throws and marks a failure 'failed' (replayable
  // from the Email Inbox), so acknowledging now loses nothing.
  const intake = processInboundEmail(email.id).catch((e) => {
    console.error(`[botIngest] intake failed for ${email.id}:`, e);
  });
  // Supabase's runtime keeps the isolate alive for this; locally (supabase
  // functions serve) there is no EdgeRuntime, so fall back to awaiting.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(intake);
  } else {
    await intake;
  }

  return okResponse(
    {
      status: "accepted",
      id: email.id,
      message_id: p.message_id,
      workspace_id: ws.workspaceId,
      attachments_extracted: files.length,
    },
    202,
  );
}));
