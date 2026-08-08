/**
 * Drop-in replacement for Base44's integrations/Core module.
 * All exports match the original API surface.
 */
import { invokeLLM, invokeLLMJson } from "@/lib/llm";
import { supabase } from "@/lib/supabase";

// ── InvokeLLM ─────────────────────────────────────────────────────────────────
export const InvokeLLM = invokeLLM;

/**
 * Structured-output twin of InvokeLLM. Callers that pass a
 * `response_json_schema` and then read fields off the result need this one —
 * InvokeLLM resolves to a plain string, so `result.message` on it is always
 * undefined regardless of the schema. (The proxy ignores the schema itself and
 * enforces JSON via its system prompt; the schema stays as caller-side intent.)
 */
export const InvokeLLMJson = invokeLLMJson;

// ── InvokeFunction ────────────────────────────────────────────────────────────
// Routes to Supabase Edge Functions.
export async function InvokeFunction({ function_name, payload = {} }) {
  const { data, error } = await supabase.functions.invoke(function_name, { body: payload });
  if (error) throw error;
  return data;
}

// ── SendEmail ─────────────────────────────────────────────────────────────────
// Calls the send-email Edge Function.
export async function SendEmail({ to, subject, body, from, cc, reply_to }) {
  return InvokeFunction({
    function_name: "sendEmail",
    payload: { to, subject, body, from, cc, reply_to },
  });
}

// ── UploadFile ────────────────────────────────────────────────────────────────
// Uploads to the private Supabase Storage bucket "uploads" (see migration 023).
//
// Two rules the storage policies enforce, which this must cooperate with:
//   • objects live under `<user-id>/…` — writes outside your own folder are
//     rejected, so uploads cannot clobber another recruiter's file;
//   • the bucket is PRIVATE — there is no public URL. Access is via a
//     short-lived signed URL.
//
// PERSIST `path`, NOT `file_url`. The returned `file_url` is a signed URL that
// expires (default 1 hour); it exists so the caller can hand the file straight
// to an extraction function. Anything written to a row — candidates.resume_url,
// resumes.file_url — must store `path` and be rendered through
// resolveFileUrl()/<FileLink>, or the link is dead within the hour.

export const UPLOAD_BUCKET = "uploads";

/** Mirrors storage.buckets.file_size_limit in migration 023. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Extension → canonical MIME type. Must stay in lockstep with the bucket's
 * `allowed_mime_types` (migration 023): Storage rejects anything else.
 *
 * The upload sends the type from THIS map rather than `file.type`, because
 * browsers are unreliable about Office formats — Chrome on Android commonly
 * reports a .docx as `application/octet-stream`, which the bucket refuses. The
 * extension is already validated below, so it is the more trustworthy signal,
 * and adding `application/octet-stream` to the allow-list instead would defeat
 * the restriction entirely (every file would qualify).
 */
const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};

export const ALLOWED_UPLOAD_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Strip anything that could escape the user's folder or confuse Storage:
 * separators, leading dots, and characters outside a conservative set.
 */
function safeFileName(name) {
  const base = String(name || "file").split(/[/\\]/).pop();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 120) || "file";
}

function extensionOf(name) {
  const dot = String(name || "").lastIndexOf(".");
  return dot === -1 ? "" : String(name).slice(dot).toLowerCase();
}

/**
 * Throws a user-readable Error when the file fails the bucket's own limits.
 * @returns the validated lowercase extension.
 */
function assertUploadable(file) {
  if (!file) throw new Error("No file selected.");

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `${file.name} is ${mb} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
    );
  }

  const ext = extensionOf(file.name);
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw new Error(
      `${ext || "That file type"} isn't supported. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}.`
    );
  }
  return ext;
}

export async function UploadFile({
  file,
  bucket = UPLOAD_BUCKET,
  path = null,
  expiresIn = SIGNED_URL_TTL_SECONDS,
}) {
  // Client-side pre-checks: fast, friendly failure. Storage re-enforces both
  // limits server-side, so this is UX and not the control.
  const ext = assertUploadable(file);

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("You must be signed in to upload files.");

  // The `<uid>/` prefix is what the uploads_insert policy checks.
  const filePath = path || `${userId}/${Date.now()}-${safeFileName(file.name)}`;

  const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
    // Not upsert: paths are per-user and timestamped, so a collision means
    // something is wrong. Failing loudly beats silently destroying a resume.
    upsert: false,
    contentType: MIME_BY_EXTENSION[ext],
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, expiresIn);
  if (signErr) throw signErr;

  return {
    file_url: signed.signedUrl, // short-lived — for immediate use only
    url: signed.signedUrl,      // legacy alias
    path: data.path,            // ← persist this
    bucket,
    expires_in: expiresIn,
  };
}

/** Mint a fresh signed URL for a stored path. */
export async function getSignedUrl(path, { bucket = UPLOAD_BUCKET, expiresIn = SIGNED_URL_TTL_SECONDS } = {}) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Turn a stored file reference into something openable.
 *
 * The same column holds three generations of value, so all three must resolve:
 *   • a storage path (`<uid>/123-cv.pdf`) — what UploadFile writes now;
 *   • an external URL a recruiter pasted by hand into "Resume URL";
 *   • a legacy public/base44 URL from before the bucket went private.
 * Only the first needs signing; the others are already absolute.
 */
export async function resolveFileUrl(value, options) {
  if (!value) return null;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  return getSignedUrl(value, options);
}

// ── ExtractDataFromUploadedFile ───────────────────────────────────────────────
// Calls the extract-data Edge Function.
export async function ExtractDataFromUploadedFile({ file_url, extraction_prompt }) {
  return InvokeFunction({
    function_name: "extractDataFromFile",
    payload: { file_url, extraction_prompt },
  });
}

// ── GenerateImage ─────────────────────────────────────────────────────────────
// Falls through to OpenAI DALL·E via Edge Function.
export async function GenerateImage({ prompt, size = "1024x1024" }) {
  return InvokeFunction({ function_name: "generateImage", payload: { prompt, size } });
}

// ── SendSMS ───────────────────────────────────────────────────────────────────
export async function SendSMS({ to, body }) {
  return InvokeFunction({ function_name: "sendSMS", payload: { to, body } });
}

// ── Core namespace (for backwards compatibility with `Core.InvokeLLM` usage) ──
export const Core = {
  InvokeLLM,
  InvokeFunction,
  SendEmail,
  UploadFile,
  getSignedUrl,
  resolveFileUrl,
  ExtractDataFromUploadedFile,
  GenerateImage,
  SendSMS,
};
