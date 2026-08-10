-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 025: Add runtime LLM model settings and OpenAI-compatible endpoint config
-- ═══════════════════════════════════════════════════════════════════════════

-- New columns on ai_recruiter_settings for model routing and a generic
-- OpenAI-compatible endpoint (local Qwen / vLLM / tunnel / hosted proxy).
-- The API key for the generic endpoint still lives in Supabase Edge Function
-- secrets (OPENAI_COMPATIBLE_API_KEY); base URL and model id are non-secret.
ALTER TABLE ai_recruiter_settings
  ADD COLUMN IF NOT EXISTS insights_model               TEXT DEFAULT 'local/google/gemma-4-12b-qat',
  ADD COLUMN IF NOT EXISTS openai_compatible_base_url   TEXT,
  ADD COLUMN IF NOT EXISTS openai_compatible_model      TEXT;

-- Backfill the single settings row to local-first defaults. The local LM
-- Studio fleet (reached through the cloudflared tunnel, addressed with the
-- `local/` prefix) is free, so it is the preference; when the tunnel is down
-- or unconfigured, the Edge Function fallback chain in _shared/llm.ts
-- automatically degrades to deepseek-chat → qwen-turbo → claude-3-5-haiku.
UPDATE ai_recruiter_settings
SET
  default_model               = COALESCE(NULLIF(default_model, ''), 'local/google/gemma-4-12b-qat'),
  matching_model              = COALESCE(NULLIF(matching_model, ''), 'local/google/gemma-4-12b-qat'),
  drafting_model              = COALESCE(NULLIF(drafting_model, ''), 'local/google/gemma-4-12b-qat'),
  parsing_model               = COALESCE(NULLIF(parsing_model, ''), 'local/google/gemma-4-12b-qat'),
  insights_model              = COALESCE(NULLIF(insights_model, ''), 'local/google/gemma-4-12b-qat');
