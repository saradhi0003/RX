-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 031: Make the LLM fallback chain configurable from the UI.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS EXISTS
-- The fallback order was a hardcoded constant in _shared/modelRouting.ts
-- (deepseek-chat → qwen-turbo → claude-3-5-haiku). That is not something an
-- operator can reason about or control: which model actually answered was
-- decided in code, and the only way to find out after the fact was to read the
-- model name in llm_usage. A dead tunnel silently rerouted "free" local
-- requests onto a billable provider that way.
--
-- The chain now lives in ai_recruiter_settings alongside the per-task models,
-- so the whole routing decision — primary AND ordered fallbacks — is visible
-- and editable in AI Recruiter Settings, and is deterministic: the app tries
-- exactly the models listed, in exactly that order.
--
--   fallback_models     ordered TEXT[]; empty means NO fallback at all, which
--                       is the zero-cost guarantee — a local primary that
--                       fails then fails loudly instead of quietly billing.
--   llm_allow_paid_fallback
--                       explicit opt-in for spending money when the primary is
--                       a free `local/…` model. Defaults FALSE: asking for
--                       local is an instruction to run for free, and answering
--                       it with a paid provider is the one outcome that
--                       instruction rules out.
--
-- Defaults are deliberately conservative — empty chain + no paid fallback —
-- so an existing install keeps costing nothing until someone opts in through
-- the UI.

ALTER TABLE ai_recruiter_settings
  ADD COLUMN IF NOT EXISTS fallback_models          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS llm_allow_paid_fallback  BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ai_recruiter_settings.fallback_models IS
  'Ordered model ids tried after the primary fails. Empty = no fallback (never spends).';
COMMENT ON COLUMN ai_recruiter_settings.llm_allow_paid_fallback IS
  'Allow a paid provider to answer when the primary is a free local/ model. Default false.';
