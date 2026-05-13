-- ============================================================================
-- 009_expenses_extended.sql
--   PASTE INTO Supabase Dashboard → SQL Editor → Run
--
-- The Expenses page UI uses richer fields than the original expenses table
-- (e.g. name, type, amount_usd, amount_original, currency_original, location,
-- source). This migration extends the expenses table to match the UI + the
-- new bank-statement upload feature, without removing existing columns.
-- ============================================================================

BEGIN;

-- New columns ----------------------------------------------------------------
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS name              TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type              TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_usd        NUMERIC(12,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_original   NUMERIC(12,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency_original TEXT DEFAULT 'USD';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location          TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'manual';

-- Back-fill the new columns from the legacy ones so existing rows render -----
UPDATE expenses SET name              = title    WHERE name IS NULL AND title IS NOT NULL;
UPDATE expenses SET amount_usd        = amount   WHERE amount_usd IS NULL AND amount IS NOT NULL;
UPDATE expenses SET amount_original   = amount   WHERE amount_original IS NULL AND amount IS NOT NULL;
UPDATE expenses SET currency_original = currency WHERE currency_original IS NULL AND currency IS NOT NULL;
UPDATE expenses SET type              = category WHERE type IS NULL AND category IS NOT NULL;

-- Widen the CHECK constraint on category to match what the UI emits ---------
-- (drop & re-add as a partial superset that includes the UI's types)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IS NULL OR category IN (
    'salary','maintenance','travel','utilities','rent','software',
    'marketing','office','other'
  ));

-- Source provenance constraint (admin / bank_statement / csv / manual) ------
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_source_check
  CHECK (source IS NULL OR source IN ('manual','csv','bank_statement','api'));

COMMIT;

-- Verify:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'expenses'
ORDER BY ordinal_position;
