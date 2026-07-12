/**
 * aiRecruiterParseJob
 * POST { job_description: string, source?: string, run_id?: string }
 * Extracts structured job data from free text and upserts a Job + Run record.
 */
import { supabase, getAISettings } from "../_shared/supabaseClient.ts";
import { invokeLLMJson, checkDailyCeiling } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

interface ParsedJob {
  title: string;
  company_name: string;
  location: string;
  job_type: string;
  salary_range: string;
  description: string;
  requirements: string;
  skills_required: string[];
  experience_min: number | null;
  experience_max: number | null;
  openings: number;
}

const SYSTEM = `You are an expert recruiter assistant. Extract structured job information from the text.
Return JSON exactly matching:
{
  "title": "string",
  "company_name": "string or empty",
  "location": "string or empty",
  "job_type": "full_time|part_time|contract|c2c|remote|hybrid",
  "salary_range": "string or empty",
  "description": "summary of role (2-3 sentences)",
  "requirements": "key requirements as bullet points",
  "skills_required": ["array", "of", "skills"],
  "experience_min": null or integer years,
  "experience_max": null or integer years,
  "openings": 1
}`;

Deno.serve(withErrorHandling(async (req) => {
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
      .insert({ source, status: "started", model_used: model })
      .select("id")
      .single();
    runId = run?.id;
  }

  // Parse job via LLM
  const parsed = await invokeLLMJson<ParsedJob>(
    `Parse this job description:\n\n${job_description}`,
    SYSTEM,
    model
  );

  // Insert job record
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      title: parsed.title || "Untitled Role",
      company_name: parsed.company_name,
      location: parsed.location,
      job_type: parsed.job_type || "full_time",
      salary_range: parsed.salary_range,
      description: parsed.description,
      requirements: parsed.requirements,
      skills_required: parsed.skills_required || [],
      experience_min: parsed.experience_min,
      experience_max: parsed.experience_max,
      openings: parsed.openings || 1,
      raw_text: job_description,
      source,
      status: "open",
      parsed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr) return errResponse(`Failed to create job: ${jobErr.message}`, 500);

  // Update run with job reference + status
  if (runId) {
    await supabase
      .from("ai_recruiter_runs")
      .update({ job_id: job.id, status: "parsed" })
      .eq("id", runId);
  }

  // Log activity
  await supabase.from("recruiter_activities").insert({
    run_id: runId,
    entity_type: "job",
    entity_id: job.id,
    activity_type: "ai_job_parsed",
    title: `Parsed job: ${parsed.title}`,
    description: `Model: ${model} | Skills: ${parsed.skills_required?.join(", ")}`,
  });

  return okResponse({ job_id: job.id, run_id: runId, parsed });
}));
