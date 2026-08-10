/**
 * Runtime AI Recruiter settings cache.
 *
 * `ai_recruiter_settings` holds the per-role models (matching, drafting,
 * parsing, insights, default) plus non-secret OpenAI-compatible endpoint config
 * (base URL and model id). This module loads and caches that row so the LLM
 * layer can resolve a model for any task without every call site threading
 * settings through.
 */
import { AIRecruiterSettings as AIRecruiterSettingsEntity } from "@/entities/AIRecruiterSettings";

/** @type {{ settings: object | null, loading: Promise<object> | null, fetchedAt: number }} */
let cache = { settings: null, loading: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30_000;

/** @returns {Promise<object>} the single ai_recruiter_settings row */
export async function loadAIRecruiterSettings(force = false) {
  const fresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (!force && cache.settings && fresh) return cache.settings;
  if (cache.loading) return cache.loading;

  cache.loading = (async () => {
    try {
      const rows = await AIRecruiterSettingsEntity.list("", 1);
      const settings = rows[0] || {};
      cache.settings = settings;
      cache.fetchedAt = Date.now();
      return settings;
    } finally {
      cache.loading = null;
    }
  })();

  return cache.loading;
}

/** Drop the cache and reload on next access. */
export function refreshAIRecruiterSettings() {
  cache.settings = null;
  cache.fetchedAt = 0;
  return loadAIRecruiterSettings(true);
}

function taskBucket(task) {
  const label = String(task || "").toLowerCase();
  if (/pars|extract|resum|ocr|statement/.test(label)) return "parsing";
  if (/match|recommend|shortlist|fit/.test(label)) return "matching";
  if (/draft|email|outreach|message|reply|blast/.test(label)) return "drafting";
  if (/summar|analy|insight|report|dashboard|pipeline/.test(label)) return "insights";
  return "default";
}

/**
 * Resolve a model id for a task using the settings row.
 * Falls back to sensible defaults if the row is empty/unreachable.
 *
 * @param {string} task
 * @returns {Promise<string>}
 */
export async function getModelForTask(task) {
  const settings = await loadAIRecruiterSettings();
  const bucket = taskBucket(task);

  const keyMap = {
    parsing: "parsing_model",
    matching: "matching_model",
    drafting: "drafting_model",
    insights: "insights_model",
    default: "default_model",
  };

  const model = settings[keyMap[bucket]] || settings.default_model;
  if (model) return model;

  // Hard fallbacks if the settings row is completely empty.
  if (bucket === "parsing") return "gpt-4o-mini";
  return "deepseek-chat";
}

/**
 * Non-secret OpenAI-compatible endpoint config. Used by the browser
 * `openai-compatible` provider path when VITE_* env vars are not set.
 * The API key still lives in Supabase Edge Function secrets.
 *
 * @returns {Promise<{ baseUrl: string, model: string }>}
 */
export async function getOpenAICompatibleConfig() {
  const settings = await loadAIRecruiterSettings();
  return {
    baseUrl: settings?.openai_compatible_base_url || "",
    model: settings?.openai_compatible_model || "",
  };
}
