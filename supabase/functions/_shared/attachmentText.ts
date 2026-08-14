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
