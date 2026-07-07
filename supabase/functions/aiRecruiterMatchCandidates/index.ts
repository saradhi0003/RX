/**
 * aiRecruiterMatchCandidates
 * POST { job_id: string, run_id?: string, max_candidates?: number }
 * Scores all active candidates against a job and stores results in candidate_match_results.
 */
import { supabase, getAISettings } from "../_shared/supabaseClient.ts";
import { invokeLLMJson } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

interface MatchResult {
  score: number;
  recommendation: "strong_submit" | "maybe" | "not_recommended";
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  risk_flags: string[];
  ai_summary: string;
}

const MATCH_SYSTEM = `You are a senior technical recruiter. Evaluate how well this candidate matches the job.
Return JSON exactly:
{
  "score": <0-100>,
  "recommendation": "strong_submit|maybe|not_recommended",
  "matched_skills": ["skills the candidate has that the job requires"],
  "missing_skills": ["required skills the candidate lacks"],
  "strengths": ["candidate strengths relevant to this role"],
  "risk_flags": ["concerns or gaps"],
  "ai_summary": "2-3 sentence evaluation"
}`;

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { job_id, run_id, max_candidates = 50 } = body;

  if (!job_id) return errResponse("job_id is required", 400);

  // Fetch job
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("title, description, requirements, skills_required, experience_min, experience_max, location")
    .eq("id", job_id)
    .single();
  if (jobErr || !job) return errResponse("Job not found", 404);

  const aiSettings = await getAISettings();
  const model = aiSettings?.matching_model || "claude-opus-4-8";
  const minScore = aiSettings?.minimum_match_score || 50;

  // Create run if not provided
  let runId = run_id;
  if (!runId) {
    const { data: run } = await supabase
      .from("ai_recruiter_runs")
      .insert({ job_id, source: "manual", status: "started", model_used: model })
      .select("id")
      .single();
    runId = run?.id;
  } else {
    await supabase.from("ai_recruiter_runs").update({ status: "matched" }).eq("id", runId);
  }

  // Fetch candidates (active, with skills or title)
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, title, summary, skills, experience_years, location")
    .eq("status", "active")
    .limit(max_candidates);

  if (!candidates?.length) {
    return okResponse({ run_id: runId, matches: [], message: "No active candidates found" });
  }

  const jobContext = `
JOB: ${job.title}
LOCATION: ${job.location || "Any"}
REQUIRED SKILLS: ${(job.skills_required || []).join(", ")}
EXPERIENCE: ${job.experience_min ?? 0}–${job.experience_max ?? "∞"} years
REQUIREMENTS:\n${job.requirements || "Not specified"}
DESCRIPTION:\n${job.description || ""}`.trim();

  // Score candidates in parallel (up to 10 at a time to avoid rate limits)
  const results: Array<{ candidate_id: string; score: number; match: MatchResult }> = [];
  const BATCH = 10;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (c) => {
        const candidateContext = `
CANDIDATE: ${c.full_name}
TITLE: ${c.title || "Unknown"}
SKILLS: ${(c.skills || []).join(", ")}
EXPERIENCE: ${c.experience_years ?? "?"} years
LOCATION: ${c.location || "Unknown"}
SUMMARY: ${c.summary || "No summary provided"}`;

        const match = await invokeLLMJson<MatchResult>(
          `${jobContext}\n\n---\n${candidateContext}`,
          MATCH_SYSTEM,
          model
        );
        return { candidate_id: c.id, score: match.score, match };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  // Filter by minimum score and sort descending
  const qualified = results
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);

  // Persist match results
  if (qualified.length > 0) {
    await supabase.from("candidate_match_results").insert(
      qualified.map((r) => ({
        run_id: runId,
        job_id,
        candidate_id: r.candidate_id,
        score: r.match.score,
        recommendation: r.match.recommendation,
        matched_skills: r.match.matched_skills,
        missing_skills: r.match.missing_skills,
        strengths: r.match.strengths,
        risk_flags: r.match.risk_flags,
        ai_summary: r.match.ai_summary,
        model_used: model,
      }))
    );
  }

  // Update run
  await supabase
    .from("ai_recruiter_runs")
    .update({ status: "matched", match_count: qualified.length })
    .eq("id", runId);

  await supabase.from("recruiter_activities").insert({
    run_id: runId,
    entity_type: "job",
    entity_id: job_id,
    activity_type: "ai_candidates_matched",
    title: `Matched ${qualified.length} candidates to ${job.title}`,
    description: `Scored ${candidates.length} candidates. ${qualified.length} above threshold (${minScore}).`,
  });

  return okResponse({
    run_id: runId,
    job_id,
    total_scored: candidates.length,
    qualified: qualified.length,
    matches: qualified.map((r) => ({
      candidate_id: r.candidate_id,
      score: r.score,
      recommendation: r.match.recommendation,
      ai_summary: r.match.ai_summary,
    })),
  });
}));
