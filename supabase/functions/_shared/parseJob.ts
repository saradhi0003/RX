// @ts-nocheck   — Deno-runtime module; imports llm.ts which uses npm: specifiers.
/**
 * parseJob.ts — free-text → structured Job record.
 *
 * Extracted from aiRecruiterParseJob so the email intake pipeline
 * (_shared/emailProcessor.ts) parses job emails through the exact same prompt
 * and insert path as the manual UI flow. One prompt, one insert shape — a fix
 * lands in both places.
 */
import { supabase } from "./supabaseClient.ts";
import { invokeLLMJson } from "./llm.ts";

export interface ParsedJob {
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

export async function parseJobText(
  jobText: string,
  model: string,
  opts: { source?: string; workspaceId: string; runId?: string | null },
): Promise<{ jobId: string; parsed: ParsedJob }> {
  const parsed = await invokeLLMJson<ParsedJob>(
    `Parse this job description:\n\n${jobText}`,
    SYSTEM,
    model,
  );

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
      raw_text: jobText,
      source: opts.source || "manual",
      status: "open",
      parsed_at: new Date().toISOString(),
      workspace_id: opts.workspaceId,
    })
    .select("id")
    .single();

  if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

  if (opts.runId) {
    await supabase
      .from("ai_recruiter_runs")
      .update({ job_id: job.id, status: "parsed" })
      .eq("id", opts.runId);
  }

  await supabase.from("recruiter_activities").insert({
    run_id: opts.runId || null,
    entity_type: "job",
    entity_id: job.id,
    activity_type: "ai_job_parsed",
    title: `Parsed job: ${parsed.title}`,
    description: `Model: ${model} | Skills: ${parsed.skills_required?.join(", ")}`,
    workspace_id: opts.workspaceId,
  });

  return { jobId: job.id, parsed };
}
