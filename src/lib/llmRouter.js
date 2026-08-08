/**
 * llmRouter — picks which local model (and therefore which device) serves a call.
 *
 * WHY THIS IS A MODEL ROUTER AND NOT A DEVICE ROUTER
 * With LM Link, every linked machine's models are reachable from the single
 * local endpoint (`http://localhost:1234/v1`) — LM Studio tunnels the request
 * to whichever device holds the model, and the same model on two devices is
 * listed as two distinct entries. So there is nothing to load-balance across
 * hosts by hand: **naming the model is what selects the device.** Opening three
 * base URLs ourselves would duplicate the link and break whenever an address
 * changed.
 *
 * WHY IT RANKS BY PARAMETER COUNT
 * The first cut of this file matched hardcoded family names ("qwen2.5-coder",
 * "llama-3.3"). That is guesswork about someone's disk: name a family they
 * don't have and every task silently falls back to whatever happens to be
 * first. Parameter count is stated in nearly every id ("...-14b-instruct"),
 * survives re-quantisation and version bumps, and is the axis that actually
 * predicts whether a model can hold a strict JSON schema. Families are kept
 * only as a tie-breaker *within* a size band.
 *
 * RESOLUTION ORDER (first match wins)
 *   1. VITE_LMSTUDIO_MODEL      — global pin, overrides everything
 *   2. VITE_LMSTUDIO_MODEL_MAP  — {"task":"substring"} override
 *   3. ROUTES[bucket]           — size tier + family tie-break, below
 *   4. largest model available
 *
 * Every candidate is matched against the models the server *actually* reports,
 * so a preference naming an offline device falls through to the next one.
 * Nothing here assumes a device is up.
 */

// @ts-ignore — import.meta.env is Vite-injected
const env = (name) => (typeof import.meta !== "undefined" && import.meta.env?.[name]) || "";

export const LMSTUDIO_BASE_URL = env("VITE_LMSTUDIO_BASE_URL") || "http://localhost:1234/v1";

/** Global pin. Set to one exact id from /v1/models to force a model+device. */
const PINNED_MODEL = env("VITE_LMSTUDIO_MODEL");

/**
 * Size bands in billions of parameters. Deliberately coarse — the point is
 * "big enough to hold a schema" vs "small enough to be quick", not precision.
 */
const TIERS = {
  heavy: { min: 12, max: Infinity },   // strict structure, long reasoning
  balanced: { min: 6, max: 15 },       // prose, classification
  light: { min: 0, max: 6 },           // short, high-volume, latency-sensitive
};

/**
 * task bucket → { tier, prefer }.
 *
 * `prefer` breaks ties inside the band; it is never a hard requirement, so an
 * unknown family costs nothing. Override any of this with
 * VITE_LMSTUDIO_MODEL_MAP rather than editing here, so your setup survives a
 * `git pull`.
 */
export const ROUTES = {
  // Strict-JSON extraction — the failure mode is malformed output, not dull
  // prose, so bias to the largest thing available.
  parsing: { tier: "heavy", prefer: ["gpt-oss", "qwen", "gemma"] },
  scoring: { tier: "heavy", prefer: ["gpt-oss", "qwen", "gemma"] },

  // Long, reasoning-heavy work.
  matching: { tier: "heavy", prefer: ["gpt-oss", "qwen", "gemma"] },
  analysis: { tier: "heavy", prefer: ["gpt-oss", "qwen", "gemma"] },

  // Short structured labels — a mid model is plenty and much faster.
  classification: { tier: "balanced", prefer: ["qwen", "gemma", "llama"] },

  // Prose. Tone matters more than structure.
  drafting: { tier: "balanced", prefer: ["gemma", "llama", "qwen"] },
  chat: { tier: "balanced", prefer: ["llama", "gemma", "qwen"] },

  default: { tier: "balanced", prefer: [] },
};

/**
 * Free-form task labels → buckets. Call sites pass things like
 * "bank_statement_parse" and "candidate_summary", and more get coined over
 * time; requiring each to spell a bucket exactly would mean a silent fallback
 * to `default` every time someone invents a label. First hit wins.
 */
/** @type {Array<[RegExp, string]>} */
const TASK_ALIASES = [
  [/pars|extract|resum|ocr|statement/, "parsing"],
  [/classif|categor|intent|triage|route/, "classification"],
  [/scor|screen|rank|grade|evaluat/, "scoring"],
  [/match|recommend|shortlist|fit/, "matching"],
  [/draft|email|outreach|message|reply|blast/, "drafting"],
  [/summar|analy|insight|report|dashboard/, "analysis"],
  [/chat|assistant|agent|ask|conversation/, "chat"],
];

/** Map any task label onto a bucket in ROUTES. */
export function routeFor(task) {
  if (!task) return "default";
  if (ROUTES[task]) return task;
  const label = String(task).toLowerCase();
  for (const [pattern, bucket] of TASK_ALIASES) {
    if (pattern.test(label)) return bucket;
  }
  return "default";
}

/**
 * Billions of parameters advertised in a model id: "qwen2.5-14b-instruct" → 14,
 * "llama-3.2-3b" → 3, "gpt-oss-20b-mlx" → 20. Returns 0 when the id says
 * nothing, which sorts such models last for heavy work rather than excluding
 * them.
 *
 * The `\d+\.\d+` guard stops a version number being read as a size — without
 * it "llama-3.2-3b" matches "3.2" first and reports a 3.2B model by accident.
 */
export function parseParamSize(id) {
  const matches = String(id).toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/g);
  let best = 0;
  for (const m of matches) {
    const n = Number.parseFloat(m[1]);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

/** Parsed VITE_LMSTUDIO_MODEL_MAP, e.g. {"parsing":"qwen2.5-14b"} */
function userMap() {
  const raw = env("VITE_LMSTUDIO_MODEL_MAP");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn("[llmRouter] VITE_LMSTUDIO_MODEL_MAP is not valid JSON — ignoring it");
    return {};
  }
}

// ── Model discovery ─────────────────────────────────────────────────────────
// One /v1/models call per TTL, shared by concurrent callers. The listing spans
// every linked device, so it doubles as "which devices are reachable now".

const CACHE_TTL_MS = 60_000;
let cache = { at: 0, models: [] };
let inFlight = null;

/**
 * LM Studio's native listing (`/api/v0/models`) carries `type`, `state` and
 * `max_context_length`; the OpenAI-compatible one (`/v1/models`) carries only
 * ids. All three extras matter here — `type` keeps an embedding model out of a
 * chat slot, `state` avoids a cold JIT load, `max_context_length` avoids
 * sending 30k chars to a 4k-context model — so prefer v0 and fall back.
 */
const NATIVE_MODELS_URL = `${LMSTUDIO_BASE_URL.replace(/\/v1\/?$/, "")}/api/v0/models`;

/** Normalise either listing into one shape. */
function normalise(entry) {
  return {
    id: entry.id,
    // v1 omits type; treat unknown as a usable LLM rather than filtering it out.
    type: entry.type || "llm",
    loaded: entry.state ? entry.state !== "not-loaded" : null,
    maxContext: Number(entry.max_context_length) || 0,
    size: parseParamSize(entry.id),
    arch: entry.arch || "",
  };
}

/** @returns {Promise<Array<object>>} normalised entries */
export async function listModels({ force = false } = {}) {
  const fresh = Date.now() - cache.at < CACHE_TTL_MS;
  if (!force && fresh && cache.models.length) return cache.models;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const read = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status} ${res.statusText}`);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data.filter((m) => m?.id).map(normalise) : [];
    };

    let models;
    try {
      models = await read(NATIVE_MODELS_URL);
    } catch (nativeErr) {
      // Older LM Studio builds, or a proxy that only speaks the OpenAI surface.
      try {
        models = await read(`${LMSTUDIO_BASE_URL}/models`);
      } catch (cause) {
        // A refused connection to localhost surfaces as a bare "Failed to
        // fetch", which tells the user nothing about what to do.
        throw new Error(
          `Cannot reach LM Studio at ${LMSTUDIO_BASE_URL}. Open LM Studio → Developer → ` +
          `Start Server (default port 1234), or set VITE_LMSTUDIO_BASE_URL.`,
          { cause: cause?.message ? cause : nativeErr },
        );
      }
    }
    cache = { at: Date.now(), models };
    return models;
  })().finally(() => { inFlight = null; });

  return inFlight;
}

/** Drop the cache — call after linking a device or loading a model. */
export function refreshModels() {
  cache = { at: 0, models: [] };
  return listModels({ force: true });
}

/** First model whose id equals, then contains, `pattern` (case-insensitive). */
function findModel(models, pattern) {
  if (!pattern) return null;
  const needle = String(pattern).toLowerCase();
  return (
    models.find((m) => m.id.toLowerCase() === needle) ||
    models.find((m) => m.id.toLowerCase().includes(needle)) ||
    null
  );
}

/**
 * Rank the models for a bucket: inside the tier's size band first (largest
 * first, `prefer` families ahead of the rest), then everything else by size as
 * a fallback — so a band with nothing in it degrades instead of failing.
 */
function rankForBucket(models, bucket, { promptChars = 0 } = {}) {
  const { tier, prefer } = ROUTES[bucket] || ROUTES.default;
  const band = TIERS[tier] || TIERS.balanced;

  // An embedding model will happily accept a chat request and return
  // something useless. Never route generation to one.
  let usable = models.filter((m) => m.type !== "embeddings");
  if (!usable.length) usable = models;

  // ~4 chars per token. Only filter when the server told us the limit and the
  // prompt is big enough for it to matter — a wrong guess here silently hides
  // the model the user wanted.
  if (promptChars > 0) {
    const needed = promptChars / 4;
    const fits = usable.filter((m) => !m.maxContext || m.maxContext >= needed);
    if (fits.length) usable = fits;
  }

  const familyRank = (id) => {
    const lower = id.toLowerCase();
    const i = (prefer || []).findIndex((f) => lower.includes(f.toLowerCase()));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // Already-loaded beats cold: a JIT load of a 20B model costs far more than
  // the quality difference between neighbours in the same band.
  const loadRank = (m) => (m.loaded === true ? 0 : 1);

  const inBand = usable.filter((m) => m.size >= band.min && m.size <= band.max);
  const outOfBand = usable.filter((m) => !inBand.includes(m));

  // Light work wants the smallest adequate model; everything else the largest.
  const bySize = (a, b) => (tier === "light" ? a.size - b.size : b.size - a.size);
  return [
    ...inBand.sort((a, b) => loadRank(a) - loadRank(b) || familyRank(a.id) - familyRank(b.id) || bySize(a, b)),
    ...outOfBand.sort((a, b) => loadRank(a) - loadRank(b) || bySize(a, b)),
  ];
}

/**
 * Resolve the model id to send for a given task.
 *
 * @param {{task?: string, promptChars?: number}} [opts]
 *   `promptChars` lets a caller skip models whose context cannot hold the
 *   prompt (~4 chars/token); omit it to use the normal ranking.
 * @returns {Promise<string>} an id from the live models listing
 */
export async function resolveModel({ task, promptChars = 0 } = {}) {
  const models = await listModels();
  if (!models.length) {
    throw new Error(
      `LM Studio is running at ${LMSTUDIO_BASE_URL} but reports no models. ` +
      `Load one locally or on a linked device and try again.`,
    );
  }

  if (PINNED_MODEL) {
    const pinned = findModel(models, PINNED_MODEL);
    if (pinned) return pinned.id;
    throw new Error(
      `VITE_LMSTUDIO_MODEL="${PINNED_MODEL}" matches none of the models LM Studio reports. ` +
      `Available: ${models.map((m) => m.id).join(", ")}`,
    );
  }

  const bucket = routeFor(task);
  // An override on the raw label beats one on the bucket, so a single odd call
  // site can be pinned without moving its whole bucket.
  const map = userMap();
  const override = (task && map[task]) || map[bucket];
  if (override) {
    const hit = findModel(models, override);
    if (hit) return hit.id;
    console.warn(`[llmRouter] override "${override}" for "${task || bucket}" matched nothing — ranking instead`);
  }

  return rankForBucket(models, bucket, { promptChars })[0].id;
}

/**
 * What the router would do right now: every bucket, the model it picks, and
 * everything currently reachable with its parsed size. Useful from the console
 * (`import("@/lib/llmRouter").then(m => m.describeRouting()).then(console.table)`)
 * and as the basis for a health panel.
 */
export async function describeRouting() {
  const models = await listModels({ force: true });
  const resolved = {};
  for (const bucket of Object.keys(ROUTES)) {
    resolved[bucket] = await resolveModel({ task: bucket }).catch((e) => `unresolved: ${e.message}`);
  }
  return {
    baseUrl: LMSTUDIO_BASE_URL,
    pinned: PINNED_MODEL || null,
    available: models.map((m) => ({
      id: m.id, sizeB: m.size, type: m.type, loaded: m.loaded, maxContext: m.maxContext,
    })),
    resolved,
  };
}
