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
      temperature: 0.8,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `OpenAI ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callClaude(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function callLLM(systemPrompt, userPrompt) {
  const primary = LLM_PROVIDER === "claude" ? () => callClaude(systemPrompt, userPrompt) : () => callOpenAI(systemPrompt, userPrompt);
  const fallback = LLM_PROVIDER === "claude" ? () => callOpenAI(systemPrompt, userPrompt) : () => callClaude(systemPrompt, userPrompt);
  try { return await primary(); } catch (e) {
    console.warn(`Primary LLM (${LLM_PROVIDER}) failed: ${e.message}. Trying fallback.`);
    return await fallback();
  }
}

function parseEmailContent(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { subject: parsed.subject || "", body: parsed.body || "" };
  } catch {
    const lines = raw.split("\n");
    return { subject: lines[0] || "Job Opportunity", body: raw };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { run_id, job_id, candidate_ids = [], draft_type = "client_submission", to_email = "", tone = "professional", channel = "app" } = body;
    if (!job_id || candidate_ids.length === 0) return Response.json({ error: "job_id and candidate_ids are required" }, { status: 400 });

    const jobs = await base44.entities.Job.list("", 1);
    const job = jobs.find(j => j.id === job_id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    const allCandidates = await base44.entities.Candidate.list("", 500);
    const candidates = allCandidates.filter(c => candidate_ids.includes(c.id));

    const candidateDetails = candidates.map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      title: c.current_title || "Not provided",
      company: c.current_company || "Not provided",
      location: c.location || "Not provided",
      experience: c.experience_years ? `${c.experience_years} years` : "Not provided",
      skills: (c.skills || []).join(", ") || "Not provided",
      availability: c.availability || "Not provided",
      rate: c.salary_expectation ? `$${c.salary_expectation.toLocaleString()}` : "Not provided",
    }));

    let systemPrompt = "You are an expert recruiter writing professional emails. Return only valid JSON with fields: subject (string), body (string). Never invent missing info.";
    let userPrompt = "";

    if (draft_type === "client_submission") {
      userPrompt = `Write a compelling email to a hiring manager presenting candidate(s) for the role.
Job: ${job.title} at ${job.location || "Remote"}
Required skills: ${(job.required_skills || []).join(", ")}
Candidates: ${JSON.stringify(candidateDetails, null, 2)}
Tone: ${tone}`;
    } else if (draft_type === "candidate_outreach") {
      userPrompt = `Write a personalized outreach email to a candidate about a job opportunity.
Job: ${job.title} at ${job.location || "Remote"}
Job summary: ${(job.description || "").substring(0, 300)}
Candidate: ${candidateDetails[0]?.name}
Tone: ${tone}`;
    } else {
      userPrompt = `Write a professional follow-up email. Keep it brief.
Job: ${job.title}
Candidate: ${candidateDetails[0]?.name}
Tone: ${tone}`;
    }

    const raw = await callLLM(systemPrompt, userPrompt);
    const { subject: emailSubject, body: emailBody } = parseEmailContent(raw);

    const draft = await base44.entities.EmailDraft.create({
      run_id: run_id || "temp",
      job_id,
      candidate_ids,
      draft_type,
      channel,
      to_email,
      subject: emailSubject,
      body: emailBody,
      status: "draft",
      created_by_ai: true,
      model_used: LLM_PROVIDER,
    });

    if (run_id) {
      await base44.entities.AIRecruiterRun.update(run_id, { status: "draft_created" });
      await base44.entities.RecruiterActivity.create({
        run_id,
        entity_type: "email",
        entity_id: draft.id,
        activity_type: "ai_email_draft_created",
        title: `Email draft created: ${draft_type}`,
        description: `Generated ${draft_type} email for ${candidates.length} candidate(s)`,
        metadata: { draft_id: draft.id, model: LLM_PROVIDER },
      });
    }

    return Response.json({ success: true, draft: { id: draft.id, subject: emailSubject, body: emailBody, status: "draft", to_email, draft_type } });
  } catch (error) {
    console.error("aiRecruiterDraftEmail error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});