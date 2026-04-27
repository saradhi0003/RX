import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `OpenAI ${res.status}`); }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  try { return JSON.parse(content); } catch { return content; }
}

async function callClaude(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  const raw = data.content?.[0]?.text;
  if (!raw) throw new Error("Empty Claude response");
  try { return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); } catch { return raw; }
}

async function callLLM(systemPrompt, userPrompt) {
  const primary = LLM_PROVIDER === "claude" ? () => callClaude(systemPrompt, userPrompt) : () => callOpenAI(systemPrompt, userPrompt);
  const fallback = LLM_PROVIDER === "claude" ? () => callOpenAI(systemPrompt, userPrompt) : () => callClaude(systemPrompt, userPrompt);
  try { return await primary(); } catch (e) {
    console.warn(`Primary LLM (${LLM_PROVIDER}) failed: ${e.message}. Trying fallback.`);
    return await fallback();
  }
}

function normalizeSkills(skills) {
  return (skills || []).map(s => (typeof s === "string" ? s.toLowerCase().trim() : "")).filter(Boolean);
}

function calculateDeterministicScore(job, candidate) {
  let score = 0;
  const requiredSkills = normalizeSkills(job.required_skills);
  const candidateSkills = normalizeSkills(candidate.skills);
  if (requiredSkills.length > 0) {
    const matched = requiredSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    score += (matched.length / requiredSkills.length) * 35;
  }
  const preferredSkills = normalizeSkills(job.preferred_skills);
  if (preferredSkills.length > 0) {
    const matched = preferredSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    score += (matched.length / preferredSkills.length) * 15;
  }
  if (job.experience_required && candidate.experience_years) {
    if (candidate.experience_years >= job.experience_required) score += 15;
    else if (candidate.experience_years >= job.experience_required * 0.8) score += 10;
    else if (candidate.experience_years > 0) score += 5;
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { job_id, run_id = null, max_candidates = 50, filters = {} } = body;
    if (!job_id) return Response.json({ error: "job_id is required" }, { status: 400 });

    const jobs = await base44.entities.Job.list("-created_date", 100);
    const job = jobs.find(j => j.id === job_id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    let candidates = [];
    try { candidates = await base44.entities.Candidate.list("-created_date", 200); } catch { candidates = []; }

    const filtered = candidates.filter(c => {
      if (c.status === "inactive" || c.status === "do_not_contact") return false;
      if (filters.availability && c.availability !== filters.availability) return false;
      if (filters.work_authorization && c.work_authorization !== filters.work_authorization) return false;
      return true;
    });

    const scored = filtered
      .map(c => ({ candidate: c, deterministicScore: calculateDeterministicScore(job, c) }))
      .sort((a, b) => b.deterministicScore - a.deterministicScore);

    const topCandidates = scored.slice(0, Math.min(max_candidates, 15));

    const SYSTEM_PROMPT = "You are an expert technical recruiter. Analyze the fit between a job and candidate. Return JSON with: recommendation (strong_submit/maybe/not_recommended), matched_skills (array), missing_skills (array), risk_flags (array), strengths (array), weaknesses (array), summary (string), explanation (string).";

    const matches = [];
    for (const { candidate, deterministicScore } of topCandidates) {
      const userPrompt = `Job: ${job.title}
Required skills: ${(job.required_skills || []).join(", ")}
Preferred skills: ${(job.preferred_skills || []).join(", ")}
Experience required: ${job.experience_required || "not specified"} years

Candidate: ${candidate.first_name} ${candidate.last_name}
Skills: ${(candidate.skills || []).join(", ")}
Experience: ${candidate.experience_years || 0} years
Current title: ${candidate.current_title || "unknown"}
Availability: ${candidate.availability || "unknown"}
Work authorization: ${candidate.work_authorization || "unknown"}`;

      let explanation = null;
      let modelUsed = LLM_PROVIDER;
      try {
        explanation = await callLLM(SYSTEM_PROMPT, userPrompt);
      } catch (err) {
        console.warn(`LLM failed for candidate ${candidate.id}:`, err.message);
      }

      const requiredSkills = normalizeSkills(job.required_skills);
      const candidateSkills = normalizeSkills(candidate.skills);
      const matched = requiredSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
      const missing = requiredSkills.filter(s => !matched.includes(s));

      const result = {
        candidate_id: candidate.id,
        score: Math.min(100, deterministicScore + (explanation?.score_adjustment || 0)),
        recommendation: explanation?.recommendation || "maybe",
        matched_skills: matched.length > 0 ? matched : (explanation?.matched_skills || []),
        missing_skills: missing.length > 0 ? missing : (explanation?.missing_skills || []),
        risk_flags: explanation?.risk_flags || [],
        strengths: explanation?.strengths || [],
        weaknesses: explanation?.weaknesses || [],
        ai_summary: explanation?.summary || "",
        explanation: explanation?.explanation || "",
        model_used: modelUsed,
      };

      await base44.entities.CandidateMatchResult.create({
        run_id: run_id || "temp",
        job_id,
        candidate_id: candidate.id,
        score: result.score,
        recommendation: result.recommendation,
        matched_skills: result.matched_skills,
        missing_skills: result.missing_skills,
        risk_flags: result.risk_flags,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        ai_summary: result.ai_summary,
        explanation: result.explanation,
        model_used: modelUsed,
      });

      matches.push(result);
    }

    matches.sort((a, b) => b.score - a.score);

    if (run_id) {
      await base44.entities.AIRecruiterRun.update(run_id, { status: "matched", match_count: matches.length });
      await base44.entities.RecruiterActivity.create({
        run_id,
        entity_type: "job",
        entity_id: job_id,
        activity_type: "ai_candidates_matched",
        title: `Matched ${matches.length} candidates`,
        description: `AI found and ranked ${matches.length} candidates for ${job.title}`,
        metadata: { top_score: matches[0]?.score || 0, model: LLM_PROVIDER },
      });
    }

    return Response.json({ success: true, run_id: run_id || null, job_id, matches });
  } catch (error) {
    console.error("aiRecruiterMatchCandidates error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});