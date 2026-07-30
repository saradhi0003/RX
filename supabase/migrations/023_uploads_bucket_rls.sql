-- ═══════════════════════════════════════════════════════════════════════════
-- 023_uploads_bucket_rls.sql — create the resume bucket, behind the approval gate
--
-- STATE OF THE LIVE PROJECT, verified 2026-07-29 against bwjfglerixssibenkjse:
-- the bucket named 'uploads' **does not exist**. The Storage API returns
-- NoSuchBucket, and the only bucket on the project is 'meeting-recordings'.
--
-- So `Core.UploadFile()` — which defaults to bucket 'uploads' — has been
-- throwing "Bucket not found" for every call since the Base44 → Supabase
-- migration. Every upload entry point (bulk resume upload, candidate form,
-- import modal, careers form, AI quick actions) was dead. This went unnoticed
-- because a second bug hid the first: UploadFile() returned `{ url, path }`
-- while all eight call sites destructured `{ file_url }`, so the value written
-- to candidates.resume_url was `undefined` rather than an error anyone chased.
-- Both are fixed in src/integrations/Core.js alongside this migration.
--
-- ⚠ THIS IS NOT A REPORT OF A LIVE LEAK. An earlier draft of this header
-- claimed the bucket existed and was public — i.e. resumes readable by anyone
-- with the path. That was wrong: it was inferred from `getPublicUrl()` in the
-- client code (which only works against a public bucket) WITHOUT checking the
-- project. The inference was backwards — the call fails, it does not imply a
-- public bucket exists. Corrected after querying the live Storage API.
--
-- What the client code *did* guarantee is that whenever someone finally created
-- this bucket by hand in the dashboard, the only way `getPublicUrl()` could
-- return a working URL was if they ticked "public" — at which point every
-- resume would have been world-readable. This migration removes that trap by
-- creating the bucket correctly, in version control, before that happens.
--
-- SEPARATE, REAL, AND OUT OF SCOPE: the ~legacy candidates.resume_url values
-- still point at Base44 public URLs (`https://base44.app/api/apps/.../files/
-- public/...`). Those objects live on Base44's infrastructure, are readable by
-- anyone with the link, and are entirely outside this project's RLS. Nothing in
-- this migration can reach them; migrating or revoking them is its own task.
-- <FileLink> passes such absolute URLs through unchanged, so they keep working.
--
-- This migration:
--   1. creates the bucket as PRIVATE, with a size cap and a MIME allow-list
--      enforced by Storage itself (not by the browser);
--   2. adds policies gated on auth_is_approved() (020's predicate);
--   3. scopes WRITES to a per-user folder, so nobody can clobber or delete
--      another recruiter's upload.
--
-- Because the bucket does not exist yet, this is a pure addition: there is no
-- object to migrate, no public URL to invalidate, and nothing to break. The
-- `resumes` table is likewise empty (0 rows) as of 2026-07-29.
--
-- SHARED-TENANT NOTE (same reasoning as 020): reads are NOT restricted to the
-- uploader. Recruiter X is a shared-workspace CRM — a resume uploaded by one
-- recruiter must be readable by the colleague working the same requisition.
-- FinTracker's per-user `user_id = auth.uid()` read rule is correct for a
-- personal finance app and wrong here; it would hide every existing file from
-- everyone. Approval is the read gate; the per-user folder is a write gate.
-- Per-tenant read scoping stays migration 012's job and composes with this.
--
-- NOTHING TO INVALIDATE: no persisted row references this bucket, because no
-- upload to it ever succeeded (see above). Going forward the client stores the
-- storage PATH and mints short-lived signed URLs on read.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE BUCKET — private, capped, MIME-restricted.
--    ON CONFLICT so this is re-runnable, and so it also repairs the bucket if
--    someone creates it by hand (public) before this migration is applied.
--    20 MB matches FinTracker's cap and comfortably exceeds any real resume.
--    Storage enforces both limits server-side; the client-side checks in
--    Core.js are UX, not the control.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 'uploads', FALSE, 20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = FALSE,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. POLICIES
--    storage.foldername(name) splits the object path into segments; [1] is the
--    top-level folder. Uploads are keyed `<uid>/<timestamp>-<filename>`, so
--    this pins writes to the caller's own folder.
--
--    Note there is deliberately NO anon policy. /Careers renders behind
--    PrivateRoute today, so the public application form cannot reach Storage.
--    If it is ever made genuinely public, give it its own bucket (or an
--    `applications/` prefix policy) rather than granting anon write here —
--    anon write to a bucket approved users read is a malware-delivery path.
-- ─────────────────────────────────────────────────────────────────────────────

-- READ: any approved user (shared workspace — see the note above).
DROP POLICY IF EXISTS "uploads_select" ON storage.objects;
CREATE POLICY "uploads_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads' AND auth_is_approved());

-- WRITE: approved, and only into your own folder.
DROP POLICY IF EXISTS "uploads_insert" ON storage.objects;
CREATE POLICY "uploads_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth_is_approved()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- OVERWRITE: your own folder, or an admin cleaning up.
DROP POLICY IF EXISTS "uploads_update" ON storage.objects;
CREATE POLICY "uploads_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'uploads'
    AND auth_is_approved()
    AND ((storage.foldername(name))[1] = auth.uid()::text OR auth_is_admin())
  );

-- DELETE: same rule. Without the folder check any approved user could wipe
-- every resume in the bucket.
DROP POLICY IF EXISTS "uploads_delete" ON storage.objects;
CREATE POLICY "uploads_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth_is_approved()
    AND ((storage.foldername(name))[1] = auth.uid()::text OR auth_is_admin())
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these after applying.
-- ═══════════════════════════════════════════════════════════════════════════

-- (a) The bucket must be private and capped.
SELECT id, public, file_size_limit, array_length(allowed_mime_types, 1) AS mime_types
  FROM storage.buckets WHERE id = 'uploads';

-- (b) Four policies, all mentioning auth_is_approved().
SELECT policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects'
   AND policyname LIKE 'uploads_%'
 ORDER BY policyname;

-- (c) Expected to be 0 on first apply — the bucket is new, so there are no
--     objects at all. If it is ever non-zero, those objects sit outside a
--     `<uid>/` folder and so fail the write policies (reads still work);
--     relocate them under a `<uid>/` prefix to make them editable again.
SELECT count(*) AS objects_outside_a_user_folder
  FROM storage.objects
 WHERE bucket_id = 'uploads'
   AND (storage.foldername(name))[1] !~ '^[0-9a-f-]{36}$';

-- (d) The real test is NOT in SQL. Upload something from the app, then confirm
--     the public route refuses it while a signed URL serves it:
--       curl -s "$VITE_SUPABASE_URL/storage/v1/object/public/uploads/<path>"
--     And an approved user's signed URL must still work:
--       curl -s "$VITE_SUPABASE_URL/storage/v1/object/sign/uploads/<path>" \
--         -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
