// @ts-nocheck   — Deno-runtime module; imports llm.ts which uses npm: specifiers.
/**
 * parseCandidate.ts — resume text → Candidate + Resume records.
 *
 * Extracted from parseResumeFile so the email intake pipeline
 * (_shared/emailProcessor.ts) parses resume emails through the exact same
 * prompt and insert path as the file-upload flow.
 */
import { supabase } from "./supabaseClient.ts";
import { invokeLLMJson } from "./llm.ts";

export interface ParsedCandidate {
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

export async function parseResumeText(
  resumeText: string,
  model: string,
  opts: {
    candidateId?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    source?: string;
    workspaceId: string;
  },
): Promise<{ candidateId: string; resumeId: string | null; parsed: ParsedCandidate }> {
  const parsed = await invokeLLMJson<ParsedCandidate>(
    `Parse this resume:\n\n${resumeText.slice(0, 8000)}`,
    SYSTEM,
    model,
  );

  let candidateId = opts.candidateId || null;

  if (candidateId) {
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
        source: opts.source || "imported",
        status: "active",
        workspace_id: opts.workspaceId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create candidate: ${error.message}`);
    candidateId = newCandidate.id;
  }

  const { data: resume } = await supabase
    .from("resumes")
    .upsert({
      candidate_id: candidateId,
      file_url: opts.fileUrl || null,
      file_name: opts.fileName || null,
      raw_text: resumeText,
      parsed_data: parsed,
      parsing_status: "done",
      parsed_at: new Date().toISOString(),
      is_primary: true,
      workspace_id: opts.workspaceId,
    })
    .select("id")
    .single();

  return { candidateId, resumeId: resume?.id || null, parsed };
}

/**
 * Dedupe helper for inbound email: find an existing candidate by email address
 * within a workspace, so a second resume from the same person updates their
 * record instead of duplicating it.
 */
export async function findCandidateByEmail(
  email: string,
  workspaceId: string,
): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase
    .from("candidates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .ilike("email", email.trim())
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}
