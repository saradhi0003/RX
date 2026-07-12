/**
 * aiRecruiterDraftEmail
 * POST { job_id, candidate_ids: string[], run_id?, draft_type? }
 * Drafts personalized outreach emails for selected candidates.
 */
import { supabase, getAISettings } from "../_shared/supabaseClient.ts";
import { invokeLLM, checkDailyCeiling } from "../_shared/llm.ts";
import { scrubForLLM } from "../_shared/pii.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

const SYSTEM = `You are a senior recruiter writing personalized outreach emails.
Write a concise, professional, and engaging email that:
- Opens with a personal connection to the candidate's background
- Clearly describes the opportunity and why it matches them
- Has a clear call to action (15-min call)
- Is 150-200 words maximum
- Is in plain text (no markdown)

Format exactly as:
SUBJECT: <subject line>
---
<email body>`;

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { job_id, candidate_ids, run_id, draft_type = "candidate_outreach" } = body;

  if (!job_id) return errResponse("job_id is required", 400);
  if (!candidate_ids?.length) return errResponse("candidate_ids array is required", 400);

  // Daily cost ceiling — one LLM call per candidate below.
  const ceiling = await checkDailyCeiling();
  if (!ceiling.ok) {
    return errResponse(
      `LLM daily cost ceiling reached ($${ceiling.spent.toFixed(2)} of $${ceiling.ceiling}). ` +
      "Raise LLM_DAILY_COST_CEILING_USD or wait until tomorrow (UTC).",
      429,
    );
  }

  const aiSettings = await getAISettings();
  const model = aiSettings?.drafting_model || "claude-opus-4-8";

  // Fetch job
  const { data: job } = await supabase
    .from("jobs")
    .select("title, company_name, location, description, salary_range, skills_required")
    .eq("id", job_id)
    .single();
  if (!job) return errResponse("Job not found", 404);

  // Fetch candidates
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, email, title, skills, experience_years, summary")
    .in("id", candidate_ids);
  if (!candidates?.length) return errResponse("No candidates found", 404);

  const draftIds: string[] = [];

  for (const candidate of candidates) {
    const prompt = `
JOB OPPORTUNITY:
Title: ${job.title}
Company: ${job.company_name || "Our client"}
Location: ${job.location || "Remote/Flexible"}
Salary: ${job.salary_range || "Competitive"}
Key Skills: ${(job.skills_required || []).join(", ")}
About the Role: ${scrubForLLM(job.description)}

CANDIDATE:
Name: ${candidate.full_name}
Current Title: ${candidate.title || "N/A"}
Skills: ${(candidate.skills || []).join(", ")}
Experience: ${candidate.experience_years ?? "?"} years
Bio: ${scrubForLLM(candidate.summary) || "No summary available"}

Write a personalized outreach email for this candidate.`.trim();

    const raw = await invokeLLM(prompt, SYSTEM, model);

    // Parse SUBJECT / body from the response
    const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/m);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Exciting opportunity: ${job.title}`;
    const bodyStart = raw.indexOf("---");
    const emailBody = bodyStart !== -1 ? raw.slice(bodyStart + 3).trim() : raw;

    const { data: draft } = await supabase
      .from("email_drafts")
      .insert({
        run_id: run_id || null,
        job_id,
        candidate_ids: [candidate.id],
        draft_type,
        to_email: candidate.email || null,
        subject,
        body: emailBody,
        status: "draft",
        created_by_ai: true,
        model_used: model,
      })
      .select("id")
      .single();

    if (draft) draftIds.push(draft.id);
  }

  // Update run
  if (run_id) {
    await supabase
      .from("ai_recruiter_runs")
      .update({ status: "draft_created", draft_count: draftIds.length })
      .eq("id", run_id);
  }

  await supabase.from("recruiter_activities").insert({
    run_id: run_id || null,
    entity_type: "email",
    activity_type: "ai_email_draft_created",
    title: `Created ${draftIds.length} email draft(s) for ${job.title}`,
    description: `Model: ${model} | Recipients: ${candidates.map((c) => c.full_name).join(", ")}`,
  });

  return okResponse({ draft_ids: draftIds, count: draftIds.length });
}));
