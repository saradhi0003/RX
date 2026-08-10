-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 026: Make `submissions` the one canonical candidate→job pipeline
-- table; add the columns `applications` had that `submissions` didn't.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
-- The app has carried two structurally near-identical tables for the same
-- concept — a candidate's progress through a job's pipeline — since the
-- Base44 → Supabase migration. `submissions` holds the real, actively-used
-- data (98 rows as of 2026-08-09, rendered on the "Applications" nav page).
-- `applications` has 0 rows despite several live write paths (the public
-- careers-page apply form, "add candidate to job" in Candidate Details,
-- inbound-email auto-apply), because the Dashboard and half a dozen other
-- read sites were wired to `applications` while all the historical/imported
-- pipeline data landed in `submissions` — so the Dashboard's pipeline funnel,
-- "Placed This Month" tile, and AI-insights summary have been reading an
-- empty table this whole time.
--
-- Every application code path is being redirected to `submissions` in this
-- same change (see the 12 touched files in the commit). `applications` is
-- left in place, untouched and undropped — it's a live table and dropping it
-- is a separate, more consequential decision than unifying the read/write
-- paths. It simply stops being written to going forward.
--
-- SEPARATELY: `EmailInbox.jsx`, `CandidateDetails.jsx`, and `BulkScoring.jsx`
-- write `match_score`/`score_details` on an application record — columns
-- that exist on *neither* table today, confirmed against the live schema.
-- Every one of those AI-scoring writes has been failing outright. Adding
-- them here fixes that too, independent of which table is canonical.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS offer_date       DATE,
  ADD COLUMN IF NOT EXISTS offer_amount     TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS stage            TEXT,
  ADD COLUMN IF NOT EXISTS score            NUMERIC,
  ADD COLUMN IF NOT EXISTS match_score      NUMERIC,
  ADD COLUMN IF NOT EXISTS score_details    JSONB;

-- `applications.interview_date` (a single timestamptz) has no 1:1 column
-- here — `submissions.interview_dates` (jsonb) already models zero-or-more
-- interview dates, which is the more general shape. New code writes a single
-- date as `["2026-08-10T..."]` into that existing column rather than adding
-- a redundant one.
