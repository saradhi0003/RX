/**
 * parseResumeFile
 * POST { resume_text: string, candidate_id?: string, file_url?: string }
 * Extracts candidate info from raw resume text and creates/updates Candidate + Resume records.
 */
import { supabase, getAISettings } from "../_shared/supabaseClient.ts";
import { invokeLLMJson } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

interface ParsedCandidate {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  summary: string;
  skills: string[];
  experience_years: number | null;
  current_company: string;
  current_role: string;
  linkedin_url: string;
}

const SYSTEM = `You are an expert recruiting assistant. Extract structured candidate information from this resume.
Return JSON exactly matching:
{
  "full_name": "string",
  "email": "string or empty",
  "phone": "string or empty",
  "location": "city, state/country or empty",
  "title": "current/desired job title",
  "summary": "2-3 sentence professional summary",
  "skills": ["array", "of", "technical", "and", "soft", "skills"],
  "experience_years": null or integer,
  "current_company": "string or empty",
  "current_role": "string or empty",
  "linkedin_url": "string or empty"
}`;

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { resume_text, candidate_id, file_url, file_name } = body;

  if (!resume_text?.trim()) return errResponse("resume_text is required", 400);

  const aiSettings = await getAISettings();
  const model = aiSettings?.parsing_model || "claude-opus-4-8";

  const parsed = await invokeLLMJson<ParsedCandidate>(
    `Parse this resume:\n\n${resume_text.slice(0, 8000)}`,
    SYSTEM,
    model
  );

  let candidateId = candidate_id;

  if (candidateId) {
    // Update existing candidate
    await supabase
      .from("candidates")
      .update({
        full_name: parsed.full_name,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        location: parsed.location || undefined,
        title: parsed.title || undefined,
        summary: parsed.summary || undefined,
        skills: parsed.skills || [],
        experience_years: parsed.experience_years,
        current_company: parsed.current_company || undefined,
        current_role: parsed.current_role || undefined,
        linkedin_url: parsed.linkedin_url || undefined,
      })
      .eq("id", candidateId);
  } else {
    // Create new candidate
    const { data: newCandidate, error } = await supabase
      .from("candidates")
      .insert({
        full_name: parsed.full_name || "Unknown Candidate",
        email: parsed.email || null,
        phone: parsed.phone || null,
        location: parsed.location || null,
        title: parsed.title || null,
        summary: parsed.summary || null,
        skills: parsed.skills || [],
        experience_years: parsed.experience_years,
        current_company: parsed.current_company || null,
        current_role: parsed.current_role || null,
        linkedin_url: parsed.linkedin_url || null,
        source: "imported",
        status: "active",
      })
      .select("id")
      .single();

    if (error) return errResponse(`Failed to create candidate: ${error.message}`, 500);
    candidateId = newCandidate.id;
  }

  // Create/update resume record
  const { data: resume } = await supabase
    .from("resumes")
    .upsert({
      candidate_id: candidateId,
      file_url: file_url || null,
      file_name: file_name || null,
      raw_text: resume_text,
      parsed_data: parsed,
      parsing_status: "done",
      parsed_at: new Date().toISOString(),
      is_primary: true,
    })
    .select("id")
    .single();

  return okResponse({ candidate_id: candidateId, resume_id: resume?.id, parsed });
}));
