/**
 * emailNormalizers.ts — Gmail/Zoho API payloads → inbound_emails row shape.
 *
 * Pure functions, no imports: the same "split testable decisions out of Deno
 * modules" rule as modelRouting.ts. The poller (pollEmailInboxes) does the
 * fetching; these functions do the mapping, so `npm test` covers the payload
 * quirks of both providers without mocking the network.
 */

export interface InboundAttachment {
  name: string;
  contentType: string;
  /** Provider-specific handle used to download the bytes later. */
  attachmentId: string;
}

export interface NormalizedInbound {
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
  message_id: string;
  in_reply_to: string | null;
  attachments: InboundAttachment[];
  received_at: string;
  email_account_id: string;
}

/** Below this confidence the intake goes to the approval queue instead of
 *  creating a record. */
export const CONFIDENCE_THRESHOLD = 0.7;

export function shouldAutoCreate(classification: string, confidence: number): boolean {
  return (
    (classification === "job" || classification === "resume") &&
    confidence >= CONFIDENCE_THRESHOLD
  );
}

/** Only resumes worth downloading and text-extracting. */
export function isParseableAttachment(name: string, contentType: string): boolean {
  const n = String(name || "").toLowerCase();
  const ct = String(contentType || "").toLowerCase();
  return (
    n.endsWith(".pdf") ||
    n.endsWith(".docx") ||
    ct === "application/pdf" ||
    ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

/** "Jane Doe <jane@example.com>" → { name: "Jane Doe", email: "jane@example.com" } */
export function parseAddressHeader(header: string): { name: string; email: string } {
  const raw = String(header || "").trim();
  const match = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: raw.toLowerCase() };
}

/* ── Gmail ─────────────────────────────────────────────────────────────── */

/** base64url → utf-8 text (Gmail encodes bodies and headers this way). */
export function decodeBase64Url(data: string): string {
  const b64 = String(data || "").replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try {
      return atob(b64);
    } catch {
      return "";
    }
  }
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

/** Walk a Gmail payload tree for text/plain (preferred) then text/html. */
export function gmailBodies(payload: GmailPart): { text: string; html: string } {
  let text = "";
  let html = "";
  const visit = (part: GmailPart) => {
    if (part.body?.data) {
      if (part.mimeType === "text/plain" && !text) text = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/html" && !html) html = decodeBase64Url(part.body.data);
    }
    (part.parts || []).forEach(visit);
  };
  visit(payload || {});
  return { text, html };
}

function gmailHeader(headers: Array<{ name?: string; value?: string }>, name: string): string {
  const h = (headers || []).find(
    (x) => String(x.name || "").toLowerCase() === name.toLowerCase(),
  );
  return h?.value || "";
}

/** Gmail users.messages.get (format=full) → normalized row. */
export function normalizeGmailMessage(
  msg: {
    id: string;
    threadId?: string;
    internalDate?: string;
    payload?: GmailPart & { headers?: Array<{ name?: string; value?: string }> };
  },
  accountId: string,
): NormalizedInbound {
  const headers = msg.payload?.headers || [];
  const from = parseAddressHeader(gmailHeader(headers, "From"));
  const to = parseAddressHeader(gmailHeader(headers, "To"));
  const { text, html } = gmailBodies(msg.payload || {});

  const attachments: InboundAttachment[] = [];
  const collect = (part: GmailPart) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        name: part.filename,
        contentType: part.mimeType || "",
        attachmentId: part.body.attachmentId,
      });
    }
    (part.parts || []).forEach(collect);
  };
  collect(msg.payload || {});

  return {
    from_email: from.email,
    from_name: from.name,
    to_email: to.email,
    subject: gmailHeader(headers, "Subject"),
    body_text: text,
    body_html: html,
    message_id: `gmail-${msg.id}`,
    in_reply_to: gmailHeader(headers, "In-Reply-To") || null,
    attachments,
    received_at: new Date(Number(msg.internalDate || Date.now())).toISOString(),
    email_account_id: accountId,
  };
}

/* ── Zoho ──────────────────────────────────────────────────────────────── */

/**
 * Zoho Mail message (list + content endpoints merged by the caller) →
 * normalized row. `contentHtml` comes from the message-content endpoint;
 * `attachments` from the message's attachment list.
 */
export function normalizeZohoMessage(
  msg: {
    messageId: string | number;
    subject?: string;
    fromAddress?: string;
    toAddress?: string;
    receivedTime?: string | number;
    attachments?: Array<{ attachmentName?: string; attachmentId?: string | number }>;
  },
  contentHtml: string,
  accountId: string,
): NormalizedInbound {
  const from = parseAddressHeader(msg.fromAddress || "");
  const to = parseAddressHeader(msg.toAddress || "");
  const attachments: InboundAttachment[] = (msg.attachments || [])
    .filter((a) => a.attachmentName && a.attachmentId != null)
    .map((a) => ({
      name: String(a.attachmentName),
      contentType: "",
      attachmentId: String(a.attachmentId),
    }));

  return {
    from_email: from.email,
    from_name: from.name,
    to_email: to.email,
    subject: msg.subject || "",
    body_text: "",
    body_html: contentHtml || "",
    message_id: `zoho-${msg.messageId}`,
    in_reply_to: null,
    attachments,
    received_at: new Date(Number(msg.receivedTime || Date.now())).toISOString(),
    email_account_id: accountId,
  };
}

/** Crude HTML → text for classification input when no plain part exists. */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
