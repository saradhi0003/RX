-- ============================================================================
-- 011_bookings.sql
--   PASTE INTO Supabase Dashboard → SQL Editor → Run
--
-- Adds the bookings table that powers the scheduling feature. Each booking
-- auto-generates a LiveKit room name; the existing /VideoCall page joins by
-- ?room=<name>.  After the call, video_call_recordings.booking_id links the
-- recording back to the booking, and the transcribeRecording Edge Function
-- writes the post-call summary + action items onto the booking row.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,

  host_email    TEXT,
  host_name     TEXT,
  guest_email   TEXT,
  guest_name    TEXT,

  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  timezone      TEXT DEFAULT 'UTC',

  status        TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),

  -- LiveKit room name. Generated on insert (see trigger below) if NULL.
  room_name     TEXT UNIQUE,

  -- Cross-entity links (optional)
  candidate_id  UUID REFERENCES candidates(id) ON DELETE SET NULL,
  job_id        UUID REFERENCES jobs(id)       ON DELETE SET NULL,
  recording_id  UUID,        -- FK added below via ALTER (forward ref)

  -- Post-call AI artifacts (populated by transcribeRecording after Whisper)
  summary       TEXT,
  action_items  JSONB,       -- array of { task, owner, due_date_hint }

  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (end_at > start_at)
);

-- Forward-ref FK on recording_id (video_call_recordings already exists from 010)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_recording_id_fk;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_recording_id_fk
  FOREIGN KEY (recording_id) REFERENCES video_call_recordings(id) ON DELETE SET NULL;

-- Reverse link on the recordings table so transcribeRecording knows which
-- booking row to update with summary/action_items.
ALTER TABLE video_call_recordings ADD COLUMN IF NOT EXISTS booking_id UUID;
ALTER TABLE video_call_recordings DROP CONSTRAINT IF EXISTS vcr_booking_id_fk;
ALTER TABLE video_call_recordings
  ADD CONSTRAINT vcr_booking_id_fk
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_start_at     ON bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_host_email   ON bookings(host_email);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email  ON bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_bookings_candidate_id ON bookings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bookings_job_id       ON bookings(job_id);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-generate room_name on insert if not supplied.
-- Format: meet-<6 chars from id>-<unix seconds>  → unique + readable.
CREATE OR REPLACE FUNCTION bookings_default_room()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.room_name IS NULL OR NEW.room_name = '' THEN
    NEW.room_name := 'meet-' || substr(NEW.id::text, 1, 6)
                  || '-' || extract(epoch from coalesce(NEW.start_at, now()))::bigint;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bookings_default_room ON bookings;
CREATE TRIGGER trg_bookings_default_room
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_default_room();

-- RLS: any authenticated user can manage bookings (scoped by role in app code).
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_authenticated" ON bookings;
CREATE POLICY "bookings_authenticated" ON bookings
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

-- Verify:
SELECT table_name, count(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('bookings','video_call_recordings')
GROUP BY table_name;
