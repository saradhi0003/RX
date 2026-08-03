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
    const {
      run_id,
      job_id,
      candidate_ids = [],
      draft_type = "client_submission",
      to_email = "",
      tone = "professional",
      channel = "app",
      followup_schedule_id = null,
      thread_context = null,  // for follow-up drafts: array of prior email bodies
    } = body;

    if (!job_id) return Response.json({ error: "job_id is required" }, { status: 400 });
    if (draft_type !== "recruiter_clarification" && draft_type !== "followup" && candidate_ids.length === 0) {
      return Response.json({ error: "candidate_ids are required for this draft_type" }, { status: 400 });
    }

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
    let recipientEmail = to_email;

    // ── recruiter_clarification ───────────────────────────────────────────────
    if (draft_type === "recruiter_clarification") {
      // Guard: don't create a duplicate if clarification_draft_id already set
      if (job.clarification_draft_id) {
        return Response.json({ skipped: true, reason: "clarification_draft_already_exists", draft_id: job.clarification_draft_id });
      }

      // Determine which critical fields are missing
      const criticalFieldChecks = [
        { field: "rate", label: "Pay rate or salary range", value: job.rate },
        { field: "location", label: "Work location / remote policy", value: job.location },
        { field: "work_authorization", label: "Work authorization requirements", value: job.work_authorization },
        { field: "employment_type", label: "Contract type (C2C, W2, full-time, etc.)", value: job.employment_type },
        { field: "hiring_manager", label: "Hiring manager name and contact", value: job.hiring_manager },
        { field: "due_date", label: "Submission deadline / target start date", value: job.due_date },
      ];
      const missingFields = criticalFieldChecks.filter(f => !f.value || f.value === "unknown");

      if (missingFields.length === 0) {
        return Response.json({ skipped: true, reason: "no_missing_fields" });
      }

      // Determine recipient — job poster's email
      if (!recipientEmail) {
        try {
          const allUsers = await base44.entities.User.list("", 200);
          const poster = allUsers.find(u => u.email === job.created_by);
          if (poster?.email) recipientEmail = poster.email;
        } catch { /* non-critical */ }
      }
      if (!recipientEmail) {
        return Response.json({ error: "Could not determine recipient email for recruiter clarification. Set to_email in the request." }, { status: 422 });
      }

      const targetDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const questionsList = missingFields.map(f => `- ${f.label}`).join("\n");

      userPrompt = `Write a short, professional email asking a recruiter for missing job details. Return JSON with subject and body.

Job title: ${job.title}
Recipient: ${recipientEmail}
Target submission date: ${targetDate}

Missing details to ask about:
${questionsList}

Email structure:
- Subject: "Quick details needed for [job title]"
- Greeting using first name if possible
- Brief intro (1 sentence: starting submissions, want to target right profiles)
- Bulleted questions for each missing field
- Closing with target date and request for quick reply
- Keep it under 150 words total`;

    // ── followup ──────────────────────────────────────────────────────────────
    } else if (draft_type === "followup") {
      // Load follow-up schedule for context
      let schedule = null;
      let followupCount = 0;
      if (followup_schedule_id) {
        try {
          const schedules = await base44.entities.FollowupSchedule.list("", 200);
          schedule = schedules.find(s => s.id === followup_schedule_id);
          followupCount = schedule?.followup_count || 0;
          if (!recipientEmail) recipientEmail = schedule?.recipient_email || "";
        } catch { /* non-critical */ }
      }

      const priorThread = Array.isArray(thread_context) ? thread_context.join("\n\n---\n\n") : "";
      const urgencyNote = followupCount >= 2 ? "Be more direct and include a clear opt-out option." : "Keep it warm and brief.";

      userPrompt = `Write a follow-up email for a candidate submission. Return JSON with subject and body.

Job: ${job.title}
Candidate(s): ${candidates.map(c => `${c.first_name} ${c.last_name}`).join(", ") || "submitted candidates"}
Follow-up number: ${followupCount + 1}
${priorThread ? `\nPrior email thread (for context, do not copy):\n${priorThread.substring(0, 500)}` : ""}

Instructions:
- Reference a specific detail from the role or prior email (not generic "just checking in")
- Match the tone of the original submission email
- ${urgencyNote}
- Subject: use "Re:" prefix to continue thread
- Keep under 80 words`;

    // ── client_submission ─────────────────────────────────────────────────────
    } else if (draft_type === "client_submission") {
      userPrompt = `Write a compelling email to a hiring manager presenting candidate(s) for the role.
Job: ${job.title} at ${job.location || "Remote"}
Required skills: ${(job.required_skills || []).join(", ")}
Candidates: ${JSON.stringify(candidateDetails, null, 2)}
Tone: ${tone}`;

    // ── candidate_outreach ────────────────────────────────────────────────────
    } else if (draft_type === "candidate_outreach") {
      userPrompt = `Write a personalized outreach email to a candidate about a job opportunity.
Job: ${job.title} at ${job.location || "Remote"}
Job summary: ${(job.description || "").substring(0, 300)}
Candidate: ${candidateDetails[0]?.name}
Tone: ${tone}`;

    // ── follow_up (legacy value) ──────────────────────────────────────────────
    } else {
      userPrompt = `Write a professional follow-up email. Keep it brief.
Job: ${job.title}
Candidate: ${candidateDetails[0]?.name}
Tone: ${tone}`;
    }

    const raw = await callLLM(systemPrompt, userPrompt);
    const { subject: emailSubject, body: emailBody } = parseEmailContent(raw);

    const draftData = {
      run_id: run_id || "temp",
      job_id,
      candidate_ids,
      draft_type,
      channel,
      to_email: recipientEmail,
      subject: emailSubject,
      body: emailBody,
      status: "draft",
      created_by_ai: true,
      model_used: LLM_PROVIDER,
      ...(followup_schedule_id ? { followup_schedule_id } : {}),
    };

    const draft = await base44.entities.EmailDraft.create(draftData);

    // For recruiter_clarification: stamp the job with the draft ID to prevent duplicates
    if (draft_type === "recruiter_clarification") {
      await base44.entities.Job.update(job_id, { clarification_draft_id: draft.id }).catch(() => {});
    }

    // For follow-up: link the draft back to the schedule
    if (draft_type === "followup" && followup_schedule_id) {
      await base44.entities.FollowupSchedule.update(followup_schedule_id, {
        draft_id: draft.id,
        status: "drafted",
      }).catch(() => {});
    }

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

    return Response.json({ success: true, draft: { id: draft.id, subject: emailSubject, body: emailBody, status: "draft", to_email: recipientEmail, draft_type } });
  } catch (error) {
    console.error("aiRecruiterDraftEmail error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});