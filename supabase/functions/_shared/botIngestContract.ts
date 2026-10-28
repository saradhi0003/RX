/**
 * botIngestContract.ts — the request contract for the botIngest Edge Function.
 *
 * Pure functions plus one import from the (also pure) emailNormalizers.ts — the
 * same "split testable decisions out of Deno modules" rule as modelRouting.ts.
 * botIngest/index.ts does the I/O; validation, id namespacing, the secret
 * compare and the row shape live here so `npm test` covers them without a
 * Supabase or a network.
 *
 * The human-readable version of this contract is docs/BOT_INGEST.md — keep the
 * two in step.
 */
import { htmlToText, isParseableAttachment } from "./emailNormalizers.ts";

/** Which mail system the bot read the message from. 'bot' = unspecified. */
export const BOT_INGEST_SOURCES = ["gmail", "zoho", "bot"] as const;
export type BotIngestSource = (typeof BOT_INGEST_SOURCES)[number];

/** Whole request body. Two resume PDFs base64-encode to well under this. */
export const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
/** Decoded size of one attachment. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** body_text / body_html, each. Longer is a forwarded thread, not a JD or CV. */
export const MAX_BODY_CHARS = 200_000;
export const MAX_SUBJECT_CHARS = 1_000;
export const MAX_MESSAGE_ID_CHARS = 512;
/** JSON-serialized size of the caller's optional raw_payload. */
export const MAX_RAW_PAYLOAD_CHARS = 64 * 1024;
/** Default per-minute ceiling across all bot callers (BOT_INGEST_MAX_PER_MINUTE). */
export const DEFAULT_MAX_PER_MINUTE = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Looser than isPlausibleEmail on purpose: that one guards a LIKE lookup and
// rejects `_`/`%`, which would bounce real senders like jane_doe@example.com.
const EMAIL_RE = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface BotAttachmentFile {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface BotIngestPayload {
  source: BotIngestSource;
  message_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string;
  body_text: string;
  body_html: string;
  in_reply_to: string | null;
  thread_id: string | null;
  workspace_id: string | null;
  connection_id: string | null;
  received_at: string;
  raw_payload: Record<string, unknown> | null;
  /** Decoded attachment bytes (resume-type ones are text-extracted). */
  files: BotAttachmentFile[];
}

export type ValidationResult =
  | { ok: true; value: BotIngestPayload }
  | { ok: false; errors: string[] };

/**
 * Constant-time string compare, so the shared secret can't be recovered by
 * timing the 401s. Length still leaks; that is fine for a random secret.
 */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!expected || typeof provided !== "string") return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

/**
 * The id stored in `inbound_emails.message_id` (globally UNIQUE).
 *
 * Namespaced the way pollEmailInboxes stores its ids (`gmail-<id>`,
 * `zoho-<id>`), so when the bot and a connected mailbox both see the same
 * provider message, the second writer hits the dedupe instead of creating a
 * second Job/Candidate. That only works if the bot sends the provider's API
 * message id — see docs/BOT_INGEST.md. Already-prefixed ids pass through.
 */
export function storedMessageId(source: BotIngestSource, messageId: string): string {
  const prefix = `${source}-`;
  return messageId.startsWith(prefix) ? messageId : `${prefix}${messageId}`;
}

/** attachmentsToText picks PDF vs DOCX by extension, so make sure there is one. */
function attachmentName(filename: string, contentType: string): string {
  const name = filename.trim() || "attachment";
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".docx")) return name;
  const ct = contentType.toLowerCase();
  if (ct === "application/pdf") return `${name}.pdf`;
  if (ct === DOCX_TYPE) return `${name}.docx`;
  return name;
}

function optionalString(
  body: Record<string, unknown>,
  key: string,
  errors: string[],
  max = 1_000,
): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") {
    errors.push(`${key} must be a string`);
    return null;
  }
  if (v.length > max) {
    errors.push(`${key} exceeds ${max} characters`);
    return null;
  }
  return v.trim() || null;
}

function decodeAttachments(raw: unknown, errors: string[]): BotAttachmentFile[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.push("attachments must be an array");
    return [];
  }
  if (raw.length > MAX_ATTACHMENTS) {
    errors.push(`at most ${MAX_ATTACHMENTS} attachments per message`);
    return [];
  }

  const files: BotAttachmentFile[] = [];
  raw.forEach((att, i) => {
    const where = `attachments[${i}]`;
    if (!att || typeof att !== "object") {
      errors.push(`${where} must be an object`);
      return;
    }
    const a = att as Record<string, unknown>;
    const filename = typeof a.filename === "string" ? a.filename : "";
    const contentType = typeof a.content_type === "string" ? a.content_type : "";
    const b64 = typeof a.content_base64 === "string" ? a.content_base64.replace(/\s+/g, "") : "";

    if (!filename && !contentType) {
      errors.push(`${where} needs a filename or content_type`);
      return;
    }
    if (!b64) {
      errors.push(`${where}.content_base64 is required`);
      return;
    }
    // Check the size before decoding, so an oversized file is refused without
    // allocating it.
    if (Math.floor((b64.length * 3) / 4) > MAX_ATTACHMENT_BYTES + 2) {
      errors.push(`${where} exceeds ${MAX_ATTACHMENT_BYTES} bytes`);
      return;
    }
    if (b64.length % 4 !== 0 || !BASE64_RE.test(b64)) {
      errors.push(`${where}.content_base64 is not valid base64 (standard alphabet, padded)`);
      return;
    }

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    files.push({ name: attachmentName(filename, contentType), contentType, bytes });
  });
  return files;
}

/**
 * Validate and normalize a botIngest request body. Collects every problem
 * rather than stopping at the first, so a bot author fixes them in one pass.
 */
export function validateBotIngestPayload(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  const source = body.source;
  if (typeof source !== "string" || !(BOT_INGEST_SOURCES as readonly string[]).includes(source)) {
    errors.push(`source must be one of: ${BOT_INGEST_SOURCES.join(", ")}`);
  }

  const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";
  if (!messageId) errors.push("message_id is required");
  else if (messageId.length > MAX_MESSAGE_ID_CHARS) {
    errors.push(`message_id exceeds ${MAX_MESSAGE_ID_CHARS} characters`);
  }

  // Accept a bare address or a "Name <addr>" header.
  const fromRaw = typeof body.from_email === "string" ? body.from_email.trim() : "";
  const angle = fromRaw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  const fromEmail = (angle ? angle[2] : fromRaw).trim().toLowerCase();
  if (!EMAIL_RE.test(fromEmail)) errors.push("from_email must be an email address");

  let fromName = optionalString(body, "from_name", errors);
  if (!fromName && angle) fromName = angle[1].replace(/^"|"$/g, "").trim() || null;

  const toEmail = optionalString(body, "to_email", errors);
  const subject = optionalString(body, "subject", errors, MAX_SUBJECT_CHARS) ?? "";
  const bodyText = optionalString(body, "body_text", errors, MAX_BODY_CHARS) ?? "";
  const bodyHtml = optionalString(body, "body_html", errors, MAX_BODY_CHARS) ?? "";
  const inReplyTo = optionalString(body, "in_reply_to", errors, MAX_MESSAGE_ID_CHARS);
  const threadId = optionalString(body, "thread_id", errors, MAX_MESSAGE_ID_CHARS);

  const workspaceId = optionalString(body, "workspace_id", errors);
  if (workspaceId && !UUID_RE.test(workspaceId)) errors.push("workspace_id must be a UUID");
  const connectionId = optionalString(body, "connection_id", errors);
  if (connectionId && !UUID_RE.test(connectionId)) errors.push("connection_id must be a UUID");

  let receivedAt = new Date().toISOString();
  const receivedRaw = optionalString(body, "received_at", errors);
  if (receivedRaw) {
    const t = Date.parse(receivedRaw);
    if (Number.isNaN(t)) errors.push("received_at must be an ISO-8601 timestamp");
    else receivedAt = new Date(t).toISOString();
  }

  let rawPayload: Record<string, unknown> | null = null;
  if (body.raw_payload !== undefined && body.raw_payload !== null) {
    if (typeof body.raw_payload !== "object" || Array.isArray(body.raw_payload)) {
      errors.push("raw_payload must be a JSON object");
    } else if (JSON.stringify(body.raw_payload).length > MAX_RAW_PAYLOAD_CHARS) {
      errors.push(`raw_payload exceeds ${MAX_RAW_PAYLOAD_CHARS} characters`);
    } else {
      rawPayload = body.raw_payload as Record<string, unknown>;
    }
  }

  const files = decodeAttachments(body.attachments, errors);

  if (!errors.length && !subject && !bodyText.trim() && !htmlToText(bodyHtml) && !files.length) {
    errors.push("message is empty — send at least one of subject, body_text, body_html, attachments");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      source: source as BotIngestSource,
      message_id: messageId,
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      workspace_id: workspaceId,
      connection_id: connectionId,
      received_at: receivedAt,
      raw_payload: rawPayload,
      files,
    },
  };
}

/** The attachments worth text-extracting (resumes), capped like the poller. */
export function parseableFiles(files: BotAttachmentFile[], max = 2): BotAttachmentFile[] {
  return files.filter((f) => isParseableAttachment(f.name, f.contentType)).slice(0, max);
}

/**
 * The `inbound_emails` row for an accepted message.
 *
 * Attachment *bytes* are not stored — only metadata, plus the extracted text
 * under `raw_payload.extracted_attachment_text`, which is where
 * emailProcessor's resolveAttachmentText() looks on a reprocess (the same stash
 * the poller uses). The caller's own raw_payload is nested under
 * `provider_payload` so its keys can never collide with ones the processor
 * reads (a bot forwarding a Postmark-shaped `Attachments` key, say).
 */
export function buildInboundEmailRow(
  p: BotIngestPayload,
  ctx: { workspaceId: string; emailAccountId: string | null; attachmentText: string },
): Record<string, unknown> {
  const rawPayload: Record<string, unknown> = { ingest: "botIngest" };
  if (p.raw_payload) rawPayload.provider_payload = p.raw_payload;
  if (ctx.attachmentText) rawPayload.extracted_attachment_text = ctx.attachmentText;

  return {
    workspace_id: ctx.workspaceId,
    email_account_id: ctx.emailAccountId,
    source: p.source,
    ingest_channel: "bot_ingest",
    from_email: p.from_email,
    from_name: p.from_name,
    to_email: p.to_email,
    subject: p.subject,
    body_text: p.body_text,
    body_html: p.body_html,
    message_id: storedMessageId(p.source, p.message_id),
    in_reply_to: p.in_reply_to,
    thread_id: p.thread_id,
    attachments: p.files.map((f) => ({
      name: f.name,
      content_type: f.contentType,
      size_bytes: f.bytes.length,
    })),
    raw_payload: rawPayload,
    received_at: p.received_at,
    processing_status: "pending",
  };
}
