/**
 * aiRecruiterParseJob
 * POST { job_description: string, source?: string, run_id?: string }
 * Extracts structured job data from free text and upserts a Job + Run record.
 * Parse logic lives in _shared/parseJob.ts — shared with the email intake
 * pipeline so both flows use the same prompt and insert shape.
 */
import { supabase, getAISettings } from "../_shared/supabaseClient.ts";
import { checkDailyCeiling } from "../_shared/llm.ts";
import { parseJobText } from "../_shared/parseJob.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireApprovedUser } from "../_shared/auth.ts";

Deno.serve(withErrorHandling(async (req) => {
  // Approval gate — the service role bypasses RLS, so re-check here.
  const gate = await requireApprovedUser(req);
  if (gate.response) return gate.response;

  const body = await req.json();
  const { job_description, source = "manual", run_id } = body;

  if (!job_description?.trim()) return errResponse("job_description is required", 400);

  // Daily cost ceiling — entry point of the AI recruiter pipeline.
  const ceiling = await checkDailyCeiling();
  if (!ceiling.ok) {
    return errResponse(
      `LLM daily cost ceiling reached ($${ceiling.spent.toFixed(2)} of $${ceiling.ceiling}). ` +
      "Raise LLM_DAILY_COST_CEILING_USD or wait until tomorrow (UTC).",
      429,
    );
  }

  const aiSettings = await getAISettings();
  const model = aiSettings?.parsing_model || "claude-opus-4-8";

  // Create or update the run record
  let runId = run_id;
  if (!runId) {
    const { data: run } = await supabase
      .from("ai_recruiter_runs")
      .insert({ source, status: "started", model_used: model, workspace_id: gate.profile.workspace_id })
      .select("id")
      .single();
    runId = run?.id;
  }

  try {
    const { jobId, parsed } = await parseJobText(job_description, model, {
      source,
      workspaceId: gate.profile.workspace_id,
      runId,
    });
    return okResponse({ job_id: jobId, run_id: runId, parsed });
  } catch (e) {
    return errResponse(e instanceof Error ? e.message : String(e), 500);
  }
}));
