import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

async function callOpenAI(systemPrompt, userPrompt, schema) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const payload = {
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (schema) {
    payload.response_format = { type: "json_schema", json_schema: { name: "response", strict: false, schema } };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
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
      max_tokens: 2000,
      temperature: 0.3,
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

async function callLLM(systemPrompt, userPrompt, schema = null) {
  const primary = LLM_PROVIDER === "claude"
    ? () => callClaude(systemPrompt, userPrompt)
    : () => callOpenAI(systemPrompt, userPrompt, schema);
  const fallback = LLM_PROVIDER === "claude"
    ? () => callOpenAI(systemPrompt, userPrompt, schema)
    : () => callClaude(systemPrompt, userPrompt);
  try { return await primary(); } catch (e) {
    console.warn(`Primary LLM (${LLM_PROVIDER}) failed: ${e.message}. Trying fallback.`);
    return await fallback();
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { source = "manual", source_id = null, raw_text = "", job_id = null } = body;
    if (!raw_text.trim()) return Response.json({ error: "raw_text is required" }, { status: 400 });

    const parseSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        description: { type: "string" },
        requirements: { type: "string" },
        required_skills: { type: "array", items: { type: "string" } },
        preferred_skills: { type: "array", items: { type: "string" } },
        location: { type: "string" },
        remote_type: { type: "string", enum: ["onsite", "remote", "hybrid"] },
        employment_type: { type: "string", enum: ["full_time", "part_time", "contract", "contract_to_hire"] },
        rate: { type: "string" },
        experience_required: { type: "number" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      },
      required: ["title"],
    };

    const parsed = await callLLM(
      "Extract structured job information from the provided job description or email. Return valid JSON only.",
      `Job Description:\n${raw_text}`,
      parseSchema
    );

    let job;
    if (job_id) {
      job = await base44.entities.Job.update(job_id, {
        title: parsed.title,
        description: parsed.description || "",
        requirements: parsed.requirements || "",
        location: parsed.location || "",
        remote_type: parsed.remote_type || "onsite",
        employment_type: parsed.employment_type || "full_time",
        rate: parsed.rate || "",
        required_skills: parsed.required_skills || [],
        preferred_skills: parsed.preferred_skills || [],
        experience_required: parsed.experience_required || 0,
        priority: parsed.priority || "medium",
      });
    } else {
      const companies = await base44.entities.Company.list("", 1);
      const company_id = companies[0]?.id || "unknown";
      job = await base44.entities.Job.create({
        title: parsed.title,
        company_id,
        description: parsed.description || "",
        requirements: parsed.requirements || "",
        location: parsed.location || "",
        remote_type: parsed.remote_type || "onsite",
        employment_type: parsed.employment_type || "full_time",
        rate: parsed.rate || "",
        required_skills: parsed.required_skills || [],
        preferred_skills: parsed.preferred_skills || [],
        experience_required: parsed.experience_required || 0,
        priority: parsed.priority || "medium",
        status: "draft",
      });
    }

    const run = await base44.entities.AIRecruiterRun.create({
      job_id: job.id,
      source,
      source_id,
      status: "parsed",
      model_used: LLM_PROVIDER,
      started_at: new Date().toISOString(),
      summary: `Parsed job: ${job.title}`,
    });

    await base44.entities.RecruiterActivity.create({
      run_id: run.id,
      entity_type: "job",
      entity_id: job.id,
      activity_type: "ai_job_parsed",
      title: `Job parsed: ${job.title}`,
      description: "AI parsed job description and extracted key requirements",
      metadata: { source, skills_found: (parsed.required_skills || []).length },
    });

    // Detect missing critical fields and decide if clarification draft is needed
    const criticalFields = ["rate", "location", "employment_type"];
    const missingFields = criticalFields.filter(f => !parsed[f]);

    // Load settings for conditional triggers
    let settings = {};
    try {
      const settingsList = await base44.entities.AIRecruiterSettings.list("", 1);
      settings = settingsList[0] || {};
    } catch { /* use defaults */ }

    // Trigger auto-match asynchronously (fire-and-forget style — don't await to keep response fast)
    if ((settings as any).auto_match_enabled !== false) {
      fetch(req.url.replace("aiRecruiterParseJob", "autoMatchOnInsert"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
        body: JSON.stringify({ entity_type: "Job", entity_id: job.id, triggered_by: "aiRecruiterParseJob" }),
      }).catch(err => console.warn("autoMatchOnInsert call failed:", err.message));
    }

    // Trigger recruiter clarification draft if missing fields
    if ((settings as any).auto_draft_clarification !== false && missingFields.length > 0) {
      fetch(req.url.replace("aiRecruiterParseJob", "aiRecruiterDraftEmail"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
        body: JSON.stringify({
          run_id: run.id,
          job_id: job.id,
          candidate_ids: [],
          draft_type: "recruiter_clarification",
        }),
      }).catch(err => console.warn("Clarification draft call failed:", err.message));
    }

    return Response.json({ success: true, run_id: run.id, job, parsed, missing_fields: missingFields });
  } catch (error) {
    console.error("aiRecruiterParseJob error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});