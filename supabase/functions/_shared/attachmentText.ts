// @ts-nocheck   — Deno-runtime module; npm: specifiers are Deno-only.
/**
 * attachmentText.ts — bytes of a resume attachment → plain text.
 *
 * Used by pollEmailInboxes before classification, so the classifier and the
 * resume parser both see the attachment's content, not just the email body.
 *
 * Every extractor degrades to "" on failure — a corrupt PDF must not fail the
 * email. unpdf is the serverless-oriented pdfjs wrapper (no worker setup);
 * mammoth handles DOCX.
 */
import { extractText as pdfExtractText } from "npm:unpdf@^0.12";
import mammoth from "npm:mammoth@^1.8";
import { Buffer } from "node:buffer";
import { isParseableAttachment } from "./emailNormalizers.ts";

const MAX_ATTACHMENT_TEXT = 8000;
/** Resumes come one or two per email; downloading more is latency for nothing. */
export const MAX_ATTACHMENTS_PER_EMAIL = 2;

async function pdfToText(bytes: Uint8Array): Promise<string> {
  try {
    const { text } = await pdfExtractText(bytes, { mergePages: true });
    return String(text || "");
  } catch (e) {
    console.warn(`[attachmentText] PDF extraction failed: ${e instanceof Error ? e.message : e}`);
    return "";
  }
}

async function docxToText(bytes: Uint8Array): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return String(value || "");
  } catch (e) {
    console.warn(`[attachmentText] DOCX extraction failed: ${e instanceof Error ? e.message : e}`);
    return "";
  }
}

/** Concatenate extracted text from the given attachments, capped. */
export async function attachmentsToText(
  files: Array<{ name: string; bytes: Uint8Array }>,
): Promise<string> {
  let out = "";
  for (const file of files.slice(0, MAX_ATTACHMENTS_PER_EMAIL)) {
    const lower = file.name.toLowerCase();
    const text = lower.endsWith(".docx")
      ? await docxToText(file.bytes)
      : await pdfToText(file.bytes);
    if (text) {
      out += `\n\n--- Attachment: ${file.name} ---\n${text}`;
      if (out.length >= MAX_ATTACHMENT_TEXT) break;
    }
  }
  return out.slice(0, MAX_ATTACHMENT_TEXT);
}

/**
 * Postmark inbound payload → attachment text.
 *
 * Postmark inlines attachment bytes as base64 in the webhook body
 * (`Attachments: [{ Name, ContentType, Content }]`), so unlike the polled
 * providers there is nothing to download. This is also what makes a Postmark
 * email fully reprocessable later: `inbound_emails.raw_payload` keeps the
 * original body, so the CV can be re-extracted long after the fact.
 */
export async function postmarkAttachmentsToText(payload: {
  Attachments?: Array<{ Name?: string; ContentType?: string; Content?: string }>;
}): Promise<string> {
  const files: Array<{ name: string; bytes: Uint8Array }> = [];

  for (const att of payload?.Attachments || []) {
    if (files.length >= MAX_ATTACHMENTS_PER_EMAIL) break;
    if (!att?.Content || !isParseableAttachment(att.Name || "", att.ContentType || "")) continue;
    try {
      files.push({
        name: String(att.Name || "attachment"),
        bytes: Uint8Array.from(atob(att.Content), (c) => c.charCodeAt(0)),
      });
    } catch {
      // Malformed base64 — skip this one, keep the email.
    }
  }

  return files.length ? await attachmentsToText(files) : "";
}
