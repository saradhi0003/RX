/**
 * parseResumeFile
 * POST { resume_text: string, candidate_id?: string, file_url?: string, file_name?: string }
 * Extracts candidate info from raw resume text and creates/updates Candidate + Resume records.
 * Parse logic lives in _shared/parseCandidate.ts — shared with the email
 * intake pipeline so both flows use the same prompt and insert shape.
 */
import { getAISettings } from "../_shared/supabaseClient.ts";
import { parseResumeText } from "../_shared/parseCandidate.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireApprovedUser } from "../_shared/auth.ts";

Deno.serve(withErrorHandling(async (req) => {
  // Approval gate — the service role bypasses RLS, so re-check here.
  const gate = await requireApprovedUser(req);
  if (gate.response) return gate.response;

  const body = await req.json();
  const { resume_text, candidate_id, file_url, file_name } = body;

  if (!resume_text?.trim()) return errResponse("resume_text is required", 400);

  const aiSettings = await getAISettings();
  const model = aiSettings?.parsing_model || "claude-opus-4-8";

  try {
    const { candidateId, resumeId, parsed } = await parseResumeText(resume_text, model, {
      candidateId: candidate_id || null,
      fileUrl: file_url || null,
      fileName: file_name || null,
      workspaceId: gate.profile.workspace_id,
    });
    return okResponse({ candidate_id: candidateId, resume_id: resumeId, parsed });
  } catch (e) {
    return errResponse(e instanceof Error ? e.message : String(e), 500);
  }
}));
