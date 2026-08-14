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
import { escapeLikePattern, isPlausibleEmail } from "./emailNormalizers.ts";

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
    // full_name is NOT NULL with no default: writing the parser's empty string
    // back over an existing name would either blank it or reject the whole
    // patch, so it is only included when the parse actually produced one.
    const { error: updateErr } = await supabase
      .from("candidates")
      .update({
        full_name: parsed.full_name || undefined,
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
    if (updateErr) throw new Error(`Failed to update candidate: ${updateErr.message}`);
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

  // `resumes` has no unique key to conflict on, so the old `.upsert()` was a
  // plain insert: every re-parse left another row claiming is_primary, and
  // whichever one a reader picked was arbitrary. Demote first, then insert, so
  // exactly one primary survives and the older versions stay as history.
  const { error: demoteErr } = await supabase
    .from("resumes")
    .update({ is_primary: false })
    .eq("candidate_id", candidateId)
    .eq("is_primary", true);
  if (demoteErr) throw new Error(`Failed to demote previous resumes: ${demoteErr.message}`);

  const { data: resume, error: resumeErr } = await supabase
    .from("resumes")
    .insert({
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
  if (resumeErr) throw new Error(`Failed to store resume: ${resumeErr.message}`);

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
  // The address comes off an inbound `From:` header, so it is attacker-chosen.
  // Both guards matter: the shape check rejects anything that is not a single
  // address, and escaping stops a `%` from turning this lookup into a wildcard
  // that matches an unrelated candidate — whose record the caller would then
  // overwrite with the sender's "resume".
  const candidate = String(email || "").trim();
  if (!isPlausibleEmail(candidate)) return null;

  const { data } = await supabase
    .from("candidates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .ilike("email", escapeLikePattern(candidate))
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}
