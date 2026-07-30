import { supabase } from './supabase';

/**
 * The mobile half of the upload contract. Deliberately identical to the web
 * app's src/integrations/Core.js — same bucket, same caps, same per-user path —
 * because both clients write to the same bucket and the same storage policies
 * (migration 023) judge them.
 *
 * The three rules that must hold on every client:
 *   1. objects live under `<user-id>/…`  — uploads_insert rejects anything else;
 *   2. ≤ 20 MB and an allowed type      — Storage re-enforces both server-side;
 *   3. the bucket is PRIVATE            — access is via short-lived signed URLs.
 *
 * PERSIST `path`, NOT `signedUrl`. The URL expires within the hour; the path is
 * what belongs on candidates.resume_url.
 */

export const UPLOAD_BUCKET = 'uploads';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Extension → canonical MIME type. Must stay in lockstep with the bucket's
 * `allowed_mime_types` (migration 023) and with the web app's copy in
 * src/integrations/Core.js.
 *
 * The upload sends the type from THIS map rather than the picker's `mimeType`:
 * Android file providers routinely hand back `application/octet-stream` for a
 * .docx, which the bucket refuses. The extension is validated below, so it is
 * the more trustworthy signal.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};

export const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Mirrors the picker's asset shape without importing expo-document-picker here. */
export type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
};

export type UploadResult = {
  path: string;
  signedUrl: string;
  name: string;
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function safeFileName(name: string): string {
  const base = String(name || 'file').split(/[/\\]/).pop() as string;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'file';
}

/**
 * Throws a user-readable Error when the file cannot be uploaded.
 * Client-side checks are UX — Storage enforces the same limits regardless.
 *
 * @returns the validated lowercase extension.
 */
export function assertUploadable(file: PickedFile): string {
  if (!file?.uri) throw new Error('No file selected.');

  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`${file.name} is ${mb} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `${ext || 'That file type'} isn't supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`
    );
  }
  return ext;
}

/** Upload a picked file into the caller's own folder and sign it for viewing. */
export async function uploadFile(file: PickedFile): Promise<UploadResult> {
  const ext = assertUploadable(file);

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error('You must be signed in to upload files.');

  // React Native has no File object. Reading the content:// or file:// URI
  // through fetch gives an ArrayBuffer, which supabase-js uploads directly —
  // passing the bare URI string would upload the literal path as the body.
  const body = await fetch(file.uri).then((res) => res.arrayBuffer());

  if (body.byteLength > MAX_UPLOAD_BYTES) {
    // Some providers omit `size` on the picked asset, so re-check once the
    // bytes are actually in hand.
    const mb = (body.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(`${file.name} is ${mb} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  // The `<uid>/` prefix is exactly what the uploads_insert policy checks.
  const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;

  const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, body, {
    contentType: MIME_BY_EXTENSION[ext],
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);
  if (signErr) throw signErr;

  return { path: data.path, signedUrl: signed.signedUrl, name: file.name };
}
