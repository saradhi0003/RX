-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 028: Align `candidates_status_check` with the status vocabulary
-- the application actually speaks.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
-- 001_schema.sql set the constraint to active/passive/inactive/placed/
-- blacklisted and it was never revisited, while the product grew a richer,
-- staffing-specific vocabulary. BRD.jsx documents the real one:
--
--   active | on_bench | our_bench | placed | inactive | do_not_contact | screened
--
-- ...where `on_bench` (vendor bench) and `our_bench` (internal bench) are a
-- deliberate US-staffing distinction, and `screened` marks a candidate the AI
-- screening run has scored.
--
-- Four of those seven — on_bench, our_bench, do_not_contact, screened — were
-- rejected by the constraint, so selecting them anywhere in the UI failed:
--   - CandidateForm.jsx        → "Our Bench" / "Do Not Contact" options
--   - CandidateDetails (both)  → status path / STAGES
--   - Candidates.jsx           → status filter pills
--   - CandidatePreview.jsx     → "On Bench"
--   - CandidateScreening.jsx   → status:"screened" after an AI screening run,
--                                which also silently killed the score+details
--                                write riding in the same UPDATE (see 027's
--                                sibling fix in that file)
--
-- `passive` and `blacklisted` are KEPT rather than dropped even though no row
-- carries them and no UI offers them: scripts/import-csv-data.js and
-- scripts/import-base44-csv-to-supabase.mjs both hard-code them in their
-- accepted-enum lists, so removing them here would start rejecting CSV rows
-- that those importers consider valid. A constraint that accepts a superset of
-- the UI is a guardrail; one that contradicts a live import path is a bug.

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;

ALTER TABLE candidates ADD CONSTRAINT candidates_status_check
  CHECK (status = ANY (ARRAY[
    -- the documented product vocabulary
    'active'::text,
    'on_bench'::text,
    'our_bench'::text,
    'placed'::text,
    'inactive'::text,
    'do_not_contact'::text,
    'screened'::text,
    -- retained for the CSV importers (001_schema.sql's original enum)
    'passive'::text,
    'blacklisted'::text
  ]));
