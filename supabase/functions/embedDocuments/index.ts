// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or npm: imports.
/**
 * embedDocuments — build and refresh the retrieval corpus.
 *
 * POST { source_table?: "candidates"|"resumes", source_ids?: string[], limit?: number }
 *   → { processed, embedded, skipped, remaining, cost_usd }
 *
 * SELF-DRAINING BY DESIGN. Edge Functions have a hard wall-clock limit, so this
 * does a bounded slice of work and reports what is left. Call it repeatedly
 * until `remaining` is 0. That shape is what makes a backfill of any size safe
 * on a platform that will kill a long-running request.
 *
 * Two auth paths, both existing precedents in this repo:
 *   • requireAdminUser        — a human triggering a backfill
 *   • x-cron-secret           — the scheduled refresh (see scheduledFollowupRun)
 *
 * ⚠ The service role bypasses RLS *and* the stamp_workspace_id trigger, so
 *   every INSERT here sets workspace_id explicitly (supabase/functions/CLAUDE.md).
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireAdminUser, DEFAULT_WORKSPACE_ID } from "../_shared/auth.ts";
import { logLlmUsage } from "../_shared/llm.ts";
import {
  embedBatch,
  chunkText,
  hashContent,
  estimateTokens,
  toVectorLiteral,
  buildCandidateText,
  resolveEmbeddingProvider,
} from "../_shared/embeddings.ts";

/** Bounded per invocation so one call cannot exceed the function's wall clock. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

Deno.serve(withErrorHandling(async (req: Request) => {
  if (req.method !== "POST") return errResponse("Method not allowed", 405);

  // ── Auth: cron secret OR admin. Never requireApprovedUser — a cron caller
  //    has no session, and an ordinary user should not be able to spend the
  //    embedding budget.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const presented = req.headers.get("x-cron-secret");
  const isCron = Boolean(cronSecret && presented && presented === cronSecret);

  let workspaceId = DEFAULT_WORKSPACE_ID;
  if (!isCron) {
    const gate = await requireAdminUser(req);
    if (gate.response) return gate.response;
    workspaceId = gate.profile?.workspace_id || DEFAULT_WORKSPACE_ID;
  }

  const body = (await req.json().catch(() => ({}))) as {
    source_table?: string;
    source_ids?: string[];
    limit?: number;
  };
  const sourceTable = body.source_table || "candidates";
  if (!["candidates", "resumes"].includes(sourceTable)) {
    return errResponse(`Unsupported source_table "${sourceTable}"`, 400);
  }
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  // Fail fast with an actionable message rather than mid-batch.
  const { model } = resolveEmbeddingProvider();

  // ── 1. Pull a bounded slice of source rows ────────────────────────────────
  let rows: any[] = [];
  if (sourceTable === "candidates") {
    let q = supabase
      .from("candidates")
      .select("id, title, summary, skills, location, notes, experience_years, current_position, current_company, workspace_id")
      .eq("workspace_id", workspaceId)
      .limit(limit);
    if (body.source_ids?.length) q = q.in("id", body.source_ids);
    const { data, error } = await q;
    if (error) return errResponse(`Failed to read candidates: ${error.message}`, 500);
    rows = data ?? [];
  } else {
    let q = supabase
      .from("resumes")
      .select("id, candidate_id, raw_text, workspace_id")
      .eq("workspace_id", workspaceId)
      .not("raw_text", "is", null)
      .limit(limit);
    if (body.source_ids?.length) q = q.in("id", body.source_ids);
    const { data, error } = await q;
    if (error) return errResponse(`Failed to read resumes: ${error.message}`, 500);
    rows = data ?? [];
  }

  // ── 2. Chunk, and skip anything whose content is unchanged ────────────────
  const existing = new Map<string, { hash: string; hasEmbedding: boolean }>();
  if (rows.length) {
    const { data: chunks } = await supabase
      .from("doc_chunks")
      .select("source_id, chunk_index, content_hash, embedding")
      .eq("workspace_id", workspaceId)
      .eq("source_table", sourceTable)
      .in("source_id", rows.map((r) => r.id));
    for (const c of chunks ?? []) {
      existing.set(`${c.source_id}:${c.chunk_index}`, {
        hash: c.content_hash,
        hasEmbedding: c.embedding !== null,
      });
    }
  }

  type Pending = {
    source_id: string;
    candidate_id: string | null;
    chunk_index: number;
    content: string;
    content_hash: string;
  };
  const pending: Pending[] = [];
  let skipped = 0;

  for (const row of rows) {
    const text = sourceTable === "candidates" ? buildCandidateText(row) : (row.raw_text || "");
    if (!text.trim()) continue;

    const pieces = chunkText(text);
    pieces.forEach((content, chunk_index) => {
      const content_hash = hashContent(content);
      const prev = existing.get(`${row.id}:${chunk_index}`);
      // The idempotency guarantee: unchanged content that is already embedded
      // is never re-sent to the provider.
      if (prev && prev.hash === content_hash && prev.hasEmbedding) {
        skipped++;
        return;
      }
      pending.push({
        source_id: row.id,
        candidate_id: sourceTable === "candidates" ? row.id : (row.candidate_id ?? null),
        chunk_index,
        content,
        content_hash,
      });
    });
  }

  // ── 3. Embed and upsert ───────────────────────────────────────────────────
  let embedded = 0;
  let costUsd = 0;

  if (pending.length) {
    const t0 = Date.now();
    const { vectors, model: usedModel, promptTokens } = await embedBatch(
      pending.map((p) => p.content),
    );
    if (vectors.length !== pending.length) {
      return errResponse(
        `Embedding count mismatch: sent ${pending.length}, received ${vectors.length}`,
        502,
      );
    }

    const payload = pending.map((p, i) => ({
      workspace_id: workspaceId,          // explicit — service role bypasses the trigger
      source_table: sourceTable,
      source_id: p.source_id,
      candidate_id: p.candidate_id,
      chunk_index: p.chunk_index,
      content: p.content,
      content_hash: p.content_hash,
      token_estimate: estimateTokens(p.content),
      embedding_model: usedModel,
      embedding: toVectorLiteral(vectors[i]),
      embedding_stale: false,
    }));

    const { error: upsertErr } = await supabase
      .from("doc_chunks")
      .upsert(payload, { onConflict: "source_table,source_id,chunk_index" });
    if (upsertErr) return errResponse(`Failed to upsert chunks: ${upsertErr.message}`, 500);

    embedded = payload.length;

    // Embedding spend counts toward the same ceiling as chat completions.
    await logLlmUsage({
      provider: "openai",
      model: usedModel,
      promptTokens,
      completionTokens: 0,
      latencyMs: Date.now() - t0,
      task: "retrieval:embed_batch",
      workspaceId,
    });
    const { estimateCost } = await import("../_shared/pricing.ts");
    costUsd = estimateCost(usedModel, promptTokens, 0);
  }

  // ── 4. What is left, so the caller knows whether to call again ────────────
  const { count: staleCount } = await supabase
    .from("doc_chunks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("embedding_stale", true);

  // Sources that have produced no chunk at all yet.
  const { count: totalSources } = await supabase
    .from(sourceTable)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  const { data: coveredRows } = await supabase
    .from("doc_chunks")
    .select("source_id")
    .eq("workspace_id", workspaceId)
    .eq("source_table", sourceTable);
  const covered = new Set((coveredRows ?? []).map((r) => r.source_id)).size;

  return okResponse({
    source_table: sourceTable,
    model,
    processed: rows.length,
    embedded,
    skipped,
    cost_usd: Number(costUsd.toFixed(6)),
    stale_chunks: staleCount ?? 0,
    // 0 means the backfill is complete; anything else means call again.
    remaining: Math.max((totalSources ?? 0) - covered, 0),
  });
}));
