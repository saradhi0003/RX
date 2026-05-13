/**
 * Parse a resume file (PDF/DOCX) and create or update a Candidate record.
 * Called from inboundEmailWebhook when a resume attachment is detected.
 *
 * Input: { file_url, source_message_id, sender_email, sender_name }
 * Output: { candidate_id, action: "created"|"updated", resume_id }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";
const INTERNAL_TOKEN = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";

// ── LLM helpers ────────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<unknown> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 3000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error?.message || `OpenAI ${res.status}`); }
  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content;
  try { return JSON.parse(content); } catch { return content; }
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<unknown> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error?.message || `Anthropic ${res.status}`); }
  const data = await res.json() as any;
  const raw = data.content?.[0]?.text || "";
  try { return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); } catch { return raw; }
}

async function parseResumeWithLLM(resumeText: string): Promise<any> {
  const systemPrompt = `You are a resume parser. Extract structured information from resumes and return valid JSON only. If a field cannot be determined, use null.`;

  const userPrompt = `Parse this resume and return JSON with these exact fields:
{
  "first_name": string | null,
  "last_name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "linkedin_url": string | null,
  "current_title": string | null,
  "current_company": string | null,
  "experience_years": number | null,
  "skills": string[],
  "work_authorization": string | null,
  "availability": string | null,
  "summary": string | null,
  "experiences": [{"company":string,"title":string,"start_date":string|null,"end_date":string|null,"description":string|null}],
  "education": [{"school":string,"degree":string|null,"year":string|null}]
}

Resume text:
${resumeText.substring(0, 8000)}`;

  try {
    return LLM_PROVIDER === "claude"
      ? await callClaude(systemPrompt, userPrompt)
      : await callOpenAI(systemPrompt, userPrompt);
  } catch {
    return LLM_PROVIDER === "claude"
      ? await callOpenAI(systemPrompt, userPrompt)
      : await callClaude(systemPrompt, userPrompt);
  }
}

async function extractTextFromUrl(fileUrl: string, mimeType: string): Promise<string> {
  // For Base44, use ExtractDataFromUploadedFile integration when available.
  // Here we do a best-effort fetch for plain text and DOCX-as-text.
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    if (mimeType.includes("text") || fileUrl.endsWith(".txt")) {
      return await res.text();
    }

    // For PDF/DOCX, we can only get raw bytes here.
    // In production, use Base44's ExtractDataFromUploadedFile on the frontend
    // before calling this function, or integrate a PDF library.
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Naive UTF-8 text extraction (works well for DOCX XML content embedded in zip)
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(bytes);

    // Strip non-printable characters; keep readable ASCII + extended Latin
    return rawText.replace(/[^\x20-\x7E\n\r\tÀ-ɏ]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .substring(0, 10000);
  } catch (err) {
    throw new Error(`Could not extract text from file: ${(err as Error).message}`);
  }
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated users and internal function calls
    const authHeader = req.headers.get("Authorization") || "";
    const isInternalCall = INTERNAL_TOKEN && authHeader === `Bearer ${INTERNAL_TOKEN}`;

    if (!isInternalCall) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      file_url,
      source_message_id,
      sender_email,
      sender_name,
      resume_text, // optional: pre-extracted text
    } = body;

    if (!file_url && !resume_text) {
      return Response.json({ error: "file_url or resume_text is required" }, { status: 400 });
    }

    // Extract text
    let extractedText = resume_text || "";
    if (file_url && !extractedText) {
      const mimeType = body.mime_type || "application/octet-stream";
      extractedText = await extractTextFromUrl(file_url, mimeType);
    }

    if (!extractedText.trim()) {
      return Response.json({ error: "Could not extract text from file" }, { status: 422 });
    }

    // Parse with LLM
    const parsed = await parseResumeWithLLM(extractedText) as any;

    // Determine email for dedup
    const email = parsed.email || sender_email || null;

    // Deduplicate by email
    let candidate: any = null;
    let action: "created" | "updated" = "created";

    if (email) {
      try {
        const existing = await base44.entities.Candidate.list("", 500);
        candidate = existing.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
      } catch { /* no existing candidates */ }
    }

    const candidateData: Record<string, unknown> = {
      first_name: parsed.first_name || (sender_name?.split(" ")[0] || "Unknown"),
      last_name: parsed.last_name || (sender_name?.split(" ").slice(1).join(" ") || ""),
      email,
      phone: parsed.phone || null,
      location: parsed.location || null,
      linkedin_url: parsed.linkedin_url || null,
      current_title: parsed.current_title || null,
      current_company: parsed.current_company || null,
      experience_years: parsed.experience_years || null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      work_authorization: parsed.work_authorization || null,
      availability: parsed.availability || null,
      summary: parsed.summary || null,
    };

    if (candidate) {
      candidate = await base44.entities.Candidate.update(candidate.id, candidateData);
      action = "updated";
    } else {
      candidateData.source = "email_inbound";
      candidateData.status = "active";
      candidate = await base44.entities.Candidate.create(candidateData);
      action = "created";
    }

    // Create a Resume entity linked to the candidate
    let resumeRecord: any = null;
    try {
      resumeRecord = await base44.entities.Resume.create({
        candidate_id: candidate.id,
        file_url: file_url || null,
        source: "email_inbound",
        source_message_id: source_message_id || null,
        extracted_text: extractedText.substring(0, 5000),
        parsed_data: parsed,
        status: "active",
      });
    } catch (err) {
      // Resume entity may not exist — non-fatal
      console.warn("parseResumeFile: Could not create Resume entity:", (err as Error).message);
    }

    // Log activity
    await base44.entities.RecruiterActivity.create({
      entity_type: "candidate",
      entity_id: candidate.id,
      activity_type: "manual_action",
      title: `Resume ${action}: ${candidateData.first_name} ${candidateData.last_name}`,
      description: `Resume parsed from email inbound. Skills found: ${(candidateData.skills as string[]).length}`,
      metadata: { source: "email_inbound", source_message_id, action },
    });

    return Response.json({
      success: true,
      candidate_id: candidate.id,
      action,
      resume_id: resumeRecord?.id || null,
      candidate: {
        name: `${candidateData.first_name} ${candidateData.last_name}`,
        email,
        skills_count: (candidateData.skills as string[]).length,
      },
    });

  } catch (error) {
    console.error("parseResumeFile error:", (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
