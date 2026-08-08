/**
 * embeddings.ts — chunking, embedding-provider resolution, and batch embedding.
 *
 * WHY EMBEDDINGS GET THEIR OWN PROVIDER RESOLUTION
 * `detectProvider()` in llm.ts routes by chat-model name prefix, and
 * `ai_recruiter_settings.matching_model` drives it. **Anthropic has no
 * embeddings endpoint.** If embeddings inherited that setting, configuring a
 * `claude-*` matching model would make every embed call fail with an opaque
 * provider error. So embeddings resolve independently from EMBEDDING_MODEL and
 * throw a specific, actionable message for Anthropic.
 *
 * DIMENSION 768 — see the reasoning in migration 026. Short version: it is
 * nomic-embed-text's native size, so local Ollama dev shares the same column,
 * and text-embedding-3-* supports Matryoshka truncation so the quality cost is
 * negligible at this corpus size.
 *
 * The pure helpers here (chunkText, toVectorLiteral, estimateTokens,
 * hashContent, buildCandidateText) have no Deno globals and no imports, so
 * Vitest imports this module directly.
 */

export const EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/** OpenAI's per-request input cap for the embeddings endpoint. */
const MAX_INPUTS_PER_REQUEST = 96;

// ── Provider resolution ──────────────────────────────────────────────────────

export interface EmbeddingProvider {
  provider: "openai" | "ollama";
  model: string;
}

/**
 * Resolve which provider serves embeddings. Independent of the chat model.
 * @throws with an actionable message when configured with a model that has no
 *         embeddings endpoint.
 */
export function resolveEmbeddingProvider(modelOverride?: string | null): EmbeddingProvider {
  const model =
    modelOverride ||
    (typeof Deno !== "undefined" ? Deno.env.get("EMBEDDING_MODEL") : null) ||
    DEFAULT_EMBEDDING_MODEL;

  if (model.startsWith("claude")) {
    throw new Error(
      `Anthropic has no embeddings endpoint (got EMBEDDING_MODEL="${model}"). ` +
      `Set EMBEDDING_MODEL to "${DEFAULT_EMBEDDING_MODEL}" (OpenAI) or ` +
      `"nomic-embed-text" (Ollama). The chat model setting does not control embeddings.`,
    );
  }
  if (model.startsWith("nomic") || model.startsWith("mxbai") || model.startsWith("all-minilm")) {
    return { provider: "ollama", model };
  }
  return { provider: "openai", model };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** ~4 chars per token. Good enough for budgeting; never used for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length || 0) / 4);
}

/**
 * pgvector literal. PostgREST cannot coerce a JSON array into a `vector`
 * parameter, so the RPC takes TEXT and casts internally — this produces the
 * shape it expects. Do not "simplify" this to JSON.stringify of an object.
 */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Stable content fingerprint. Makes the refresh path idempotent: unchanged text
 * re-chunks to identical hashes, the upsert no-ops, and no embedding is
 * re-billed. FNV-1a rather than SHA-256 because this is a change detector, not
 * a security primitive, and it needs no async/WebCrypto ceremony.
 */
export function hashContent(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Split text on paragraph boundaries, falling back to a hard character cut.
 *
 * 400 tokens is chosen so a cited chunk is small enough for a human to read in
 * the match UI, and large enough to keep a job title and its skills together.
 * Overlap stops a fact being severed exactly at a boundary.
 */
export function chunkText(
  text: string,
  opts: { targetTokens?: number; overlapTokens?: number } = {},
): string[] {
  const targetTokens = opts.targetTokens ?? 400;
  const overlapTokens = opts.overlapTokens ?? 60;
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];

  const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > targetChars) {
      chunks.push(current.trim());
      // Carry the tail forward so a fact spanning the seam survives.
      current = current.slice(-overlapChars) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }

    // A single paragraph longer than the target still has to be split.
    while (current.length > targetChars) {
      chunks.push(current.slice(0, targetChars).trim());
      current = current.slice(targetChars - overlapChars);
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}

/**
 * Assemble the embeddable text for a candidate.
 *
 * Verified against the live corpus 2026-08-08: `resumes` is EMPTY, so resume
 * prose is not available. What exists is candidate metadata — 546 rows with
 * skills (avg 69 each), 558 with a title, 61 with a substantial summary. This
 * builds a document from those fields, labelled so the embedding has some
 * structure to latch onto rather than a bare comma-separated skill dump.
 *
 * Contact details are deliberately excluded: they carry no matching signal and
 * would be embedded verbatim into a vector store.
 */
export function buildCandidateText(c: {
  title?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  location?: string | null;
  notes?: string | null;
  experience_years?: number | null;
  current_position?: string | null;
  current_company?: string | null;
}): string {
  const parts: string[] = [];
  if (c.title) parts.push(`Title: ${c.title}`);
  if (c.current_position || c.current_company) {
    parts.push(
      `Current: ${[c.current_position, c.current_company].filter(Boolean).join(" at ")}`,
    );
  }
  if (typeof c.experience_years === "number") parts.push(`Experience: ${c.experience_years} years`);
  if (c.location) parts.push(`Location: ${c.location}`);
  if (c.skills?.length) parts.push(`Skills: ${c.skills.join(", ")}`);
  if (c.summary) parts.push(`Summary:\n${c.summary}`);
  if (c.notes) parts.push(`Notes:\n${c.notes}`);
  return parts.join("\n\n").trim();
}

// ── Batch embedding (impure — network) ───────────────────────────────────────

/**
 * Embed a batch of texts. Chunks the request into provider-sized batches and
 * preserves input order in the output.
 *
 * Cost is logged by the caller (embedDocuments), not here, because the caller
 * knows the workspace and the task label.
 */
export async function embedBatch(
  texts: string[],
  modelOverride?: string | null,
): Promise<{ vectors: number[][]; model: string; promptTokens: number }> {
  if (!texts.length) return { vectors: [], model: DEFAULT_EMBEDDING_MODEL, promptTokens: 0 };

  const { provider, model } = resolveEmbeddingProvider(modelOverride);
  const vectors: number[][] = [];
  let promptTokens = 0;

  for (let i = 0; i < texts.length; i += MAX_INPUTS_PER_REQUEST) {
    const slice = texts.slice(i, i + MAX_INPUTS_PER_REQUEST);

    if (provider === "ollama") {
      // Ollama embeds one input per call.
      for (const input of slice) {
        const base = Deno.env.get("OLLAMA_BASE_URL") || "http://host.docker.internal:11434";
        const res = await fetch(`${base}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: input }),
        });
        if (!res.ok) throw new Error(`Ollama embeddings failed: ${res.status}`);
        const json = await res.json();
        vectors.push(json.embedding);
        promptTokens += estimateTokens(input);
      }
      continue;
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set, and embeddings require it. Set the secret, or set " +
        "EMBEDDING_MODEL=nomic-embed-text with OLLAMA_BASE_URL for local development.",
      );
    }

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: slice,
        // Matryoshka truncation — must match doc_chunks.embedding vector(768).
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI embeddings failed: ${res.status} ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    // Sort defensively: the API documents index order but does not guarantee it.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) vectors.push(d.embedding);
    promptTokens += json.usage?.prompt_tokens ?? slice.reduce((s, t) => s + estimateTokens(t), 0);
  }

  return { vectors, model, promptTokens };
}
