-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 025: Add runtime LLM model settings and OpenAI-compatible endpoint config
-- ═══════════════════════════════════════════════════════════════════════════

-- New columns on ai_recruiter_settings for model routing and a generic
-- OpenAI-compatible endpoint (local Qwen / vLLM / tunnel / hosted proxy).
-- The API key for the generic endpoint still lives in Supabase Edge Function
-- secrets (OPENAI_COMPATIBLE_API_KEY); base URL and model id are non-secret.
ALTER TABLE ai_recruiter_settings
  ADD COLUMN IF NOT EXISTS insights_model               TEXT DEFAULT 'deepseek-chat',
  ADD COLUMN IF NOT EXISTS openai_compatible_base_url   TEXT,
  ADD COLUMN IF NOT EXISTS openai_compatible_model      TEXT;

-- Backfill the single settings row to the new cheapest-by-provider defaults.
-- Parsing stays on gpt-4o-mini because structured JSON extraction is still
-- more reliable there; everything else defaults to deepseek-chat.
UPDATE ai_recruiter_settings
SET
  default_model               = COALESCE(NULLIF(default_model, ''), 'deepseek-chat'),
  matching_model              = COALESCE(NULLIF(matching_model, ''), 'deepseek-chat'),
  drafting_model              = COALESCE(NULLIF(drafting_model, ''), 'deepseek-chat'),
  parsing_model               = COALESCE(NULLIF(parsing_model, ''), 'gpt-4o-mini'),
  insights_model              = COALESCE(NULLIF(insights_model, ''), 'deepseek-chat');
