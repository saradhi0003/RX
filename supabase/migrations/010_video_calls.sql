-- ============================================================================
-- 010_video_calls.sql
--   PASTE INTO Supabase Dashboard → SQL Editor → Run
--
-- Adds:
--   • Storage bucket `meeting-recordings` (private)
--   • Table `video_call_recordings` — one row per saved recording, with the
--     post-call Whisper transcript stored inline.
-- ============================================================================

BEGIN;

-- ── Storage bucket (private; access via Storage RLS below) ──────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-recordings', 'meeting-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS: authenticated users can manage their own recordings ────────
DROP POLICY IF EXISTS "rec_select" ON storage.objects;
DROP POLICY IF EXISTS "rec_insert" ON storage.objects;
DROP POLICY IF EXISTS "rec_update" ON storage.objects;
DROP POLICY IF EXISTS "rec_delete" ON storage.objects;

CREATE POLICY "rec_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "rec_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "rec_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "rec_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

-- ── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_call_recordings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room                TEXT NOT NULL,
  owner_email         TEXT,
  file_path           TEXT NOT NULL,                -- storage path in meeting-recordings/
  duration_seconds    NUMERIC(10,2),
  size_bytes          BIGINT,
  mime_type           TEXT,
  status              TEXT NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN ('uploaded','transcribing','done','failed')),
  transcript_text     TEXT,                         -- flat text for search
  transcript_json     JSONB,                        -- Whisper segments (timestamps)
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcr_room       ON video_call_recordings(room);
CREATE INDEX IF NOT EXISTS idx_vcr_owner      ON video_call_recordings(owner_email);
CREATE INDEX IF NOT EXISTS idx_vcr_created_at ON video_call_recordings(created_at DESC);

DROP TRIGGER IF EXISTS trg_vcr_updated_at ON video_call_recordings;
CREATE TRIGGER trg_vcr_updated_at
  BEFORE UPDATE ON video_call_recordings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE video_call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vcr_authenticated" ON video_call_recordings
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

-- Verify:
SELECT 'bucket'    AS k, id    FROM storage.buckets WHERE id = 'meeting-recordings'
UNION ALL
SELECT 'table'     AS k, table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'video_call_recordings';
