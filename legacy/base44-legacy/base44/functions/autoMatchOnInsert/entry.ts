/**
 * Auto-match trigger: called after a new Job or Candidate is created.
 * For jobs: runs aiRecruiterMatchCandidates.
 * For candidates: scores against recent open jobs and triggers matching for top hits.
 *
 * Input: { entity_type: "Job" | "Candidate", entity_id: string, triggered_by?: string }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

function normalizeSkills(skills: string[]): string[] {
  return (skills || []).map(s => (typeof s === "string" ? s.toLowerCase().trim() : "")).filter(Boolean);
}

function deterministicScore(job: any, candidate: any): number {
  let score = 0;
  const requiredSkills = normalizeSkills(job.required_skills || []);
  const candidateSkills = normalizeSkills(candidate.skills || []);

  if (requiredSkills.length > 0) {
    const matched = requiredSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    score += (matched.length / requiredSkills.length) * 35;
  }

  const preferredSkills = normalizeSkills(job.preferred_skills || []);
  if (preferredSkills.length > 0) {
    const matched = preferredSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    score += (matched.length / preferredSkills.length) * 15;
  }

  if (job.experience_required && candidate.experience_years) {
    if (candidate.experience_years >= job.experience_required) score += 15;
    else if (candidate.experience_years >= job.experience_required * 0.8) score += 10;
    else score += 5;
  } else if (candidate.experience_years > 0) {
    score += 8;
  }

  if (candidate.work_authorization && candidate.work_authorization !== "other") score += 10;
  if (candidate.availability === "immediately" || candidate.availability === "2_weeks") score += 10;
  else if (candidate.availability === "1_month") score += 6;
  else score += 3;
  if (candidate.status === "active" || candidate.status === "on_bench") score += 5;

  return Math.min(100, Math.max(0, score));
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { entity_type, entity_id, triggered_by = "system" } = body;

    if (!entity_type || !entity_id) {
      return Response.json({ error: "entity_type and entity_id are required" }, { status: 400 });
    }

    // Load settings to check if auto-match is enabled
    let settings: any = {};
    try {
      const settingsList = await base44.entities.AIRecruiterSettings.list("", 1);
      settings = settingsList[0] || {};
    } catch { /* use defaults */ }

    if (settings.auto_match_enabled === false) {
      return Response.json({ skipped: true, reason: "auto_match_disabled" });
    }

    const maxCandidates = settings.max_candidates || 20;
    const minScore = settings.minimum_match_score || 50;
    const autoDraftOnMatch = settings.auto_draft_on_match || false;

    let matchCount = 0;
    let jobsProcessed = 0;

    if (entity_type === "Job") {
      // Load the job
      const jobs = await base44.entities.Job.list("", 200);
      const job = jobs.find((j: any) => j.id === entity_id);

      if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
      if (job.status !== "open") return Response.json({ skipped: true, reason: "job_not_open" });

      // Create an AIRecruiterRun for this auto-match
      const run = await base44.entities.AIRecruiterRun.create({
        job_id: entity_id,
        source: "auto_match",
        status: "started",
        started_at: new Date().toISOString(),
        summary: `Auto-match triggered for ${job.title}`,
      });

      // Call aiRecruiterMatchCandidates
      try {
        const matchRes = await (await fetch(req.url.replace("autoMatchOnInsert", "aiRecruiterMatchCandidates"), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
          body: JSON.stringify({ job_id: entity_id, run_id: run.id, max_candidates: maxCandidates }),
        })).json() as any;

        matchCount = matchRes.matches?.length || 0;
        jobsProcessed = 1;

        // Optionally auto-draft if enabled and strong match exists
        if (autoDraftOnMatch && matchRes.matches?.length > 0) {
          const strongMatches = matchRes.matches.filter((m: any) => m.score >= minScore && m.recommendation === "strong_submit");
          if (strongMatches.length > 0) {
            const topCandidateIds = strongMatches.slice(0, 3).map((m: any) => m.candidate_id);
            await fetch(req.url.replace("autoMatchOnInsert", "aiRecruiterDraftEmail"), {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
              body: JSON.stringify({
                run_id: run.id, job_id: entity_id,
                candidate_ids: topCandidateIds,
                draft_type: "client_submission",
              }),
            }).catch(err => console.warn("Auto-draft failed:", (err as Error).message));
          }
        }

      } catch (err) {
        console.error("autoMatchOnInsert: aiRecruiterMatchCandidates failed:", (err as Error).message);
      }

    } else if (entity_type === "Candidate") {
      // Load the candidate
      const candidates = await base44.entities.Candidate.list("", 500);
      const candidate = candidates.find((c: any) => c.id === entity_id);
      if (!candidate) return Response.json({ error: "Candidate not found" }, { status: 404 });

      // Find recent open jobs (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const openJobs = await base44.entities.Job.list("", 200);
      const recentOpenJobs = openJobs.filter((j: any) =>
        j.status === "open" && j.created_date >= thirtyDaysAgo
      );

      if (recentOpenJobs.length === 0) {
        return Response.json({ success: true, message: "No recent open jobs to match against", matchCount: 0 });
      }

      // Score candidate against all recent open jobs (deterministic only — cheap)
      const scored = recentOpenJobs
        .map((job: any) => ({ job, score: deterministicScore(job, candidate) }))
        .sort((a: any, b: any) => b.score - a.score);

      // Take top 5 jobs and run full LLM match for this candidate
      const top5 = scored.slice(0, 5);

      for (const { job, score } of top5) {
        if (score < 30) continue; // Skip very low deterministic scores

        const run = await base44.entities.AIRecruiterRun.create({
          job_id: job.id,
          source: "auto_match_candidate",
          status: "started",
          started_at: new Date().toISOString(),
          summary: `Auto-match: ${candidate.first_name} ${candidate.last_name} vs ${job.title}`,
        });

        try {
          await fetch(req.url.replace("autoMatchOnInsert", "aiRecruiterMatchCandidates"), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
            body: JSON.stringify({ job_id: job.id, run_id: run.id, max_candidates: 1, candidate_id_filter: entity_id }),
          });
          matchCount++;
          jobsProcessed++;
        } catch (err) {
          console.warn(`autoMatchOnInsert: match for job ${job.id} failed:`, (err as Error).message);
        }
      }
    }

    // Log activity
    await base44.entities.RecruiterActivity.create({
      entity_type: entity_type === "Job" ? "job" : "candidate",
      entity_id,
      activity_type: "ai_candidates_matched",
      title: `Auto-match: ${matchCount} matches across ${jobsProcessed} job(s)`,
      description: `Triggered by ${triggered_by}`,
      metadata: { entity_type, matchCount, jobsProcessed, triggered_by },
    });

    return Response.json({ success: true, entity_type, entity_id, matchCount, jobsProcessed });

  } catch (error) {
    console.error("autoMatchOnInsert error:", (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
