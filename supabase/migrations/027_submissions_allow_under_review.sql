-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 027: Allow the 'under_review' submission status the UI already
-- offers in seven places but the CHECK constraint rejected.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
-- `submissions_status_check` allowed exactly:
--   submitted, interviewing, offered, hired, rejected, withdrawn
-- while the app treats "Screening" / "Under Review" as a first-class pipeline
-- stage throughout:
--   - KanbanBoard.jsx      — a drag lane whose droppableId IS the written status
--   - SubmissionForm.jsx   — a <SelectItem value="under_review">
--   - SubmissionDetails.jsx— a status button + colour mapping
--   - FollowUpForm.jsx     — a status option
--   - ViewSettingsModal.jsx— part of ALL_STATUSES
--   - Submissions.jsx      — a "Screening" filter pill and colour mapping
--
-- Dragging a card into "Screening" therefore fired
-- `Submission.update(id, { status: 'under_review' })`, Postgres rejected it on
-- the constraint, and KanbanBoard's catch only `console.warn`s — so the card
-- silently snapped back with nothing shown to the user. Zero rows have ever
-- carried this status, not because the stage is unused but because it was
-- impossible to set.
--
-- Widening the constraint (rather than stripping the stage out of seven UI
-- files) is the smaller, more honest change: the UI is self-consistent about
-- this stage being real, and the constraint is the single outlier — it was
-- written before the stage existed and never updated with it.

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status = ANY (ARRAY[
    'submitted'::text,
    'under_review'::text,
    'interviewing'::text,
    'offered'::text,
    'hired'::text,
    'rejected'::text,
    'withdrawn'::text
  ]));
