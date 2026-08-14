// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals.
/**
 * reprocessInboundEmail
 * POST { email_id: string, force?: boolean }
 *
 * Re-runs the shared intake path for one inbound email. Two callers:
 *   - EmailInbox, retrying a row stuck in processing_status='failed' (an LLM
 *     outage, a hit cost ceiling, a transient write error).
 *   - ApprovalQueue, on approving an `email_intake` item — that is the `force`
 *     case: a human has now vouched for a message the classifier scored below
 *     CONFIDENCE_THRESHOLD, so the record gets created despite the low score.
 *
 * Attachment text is recovered inside processInboundEmail from the stored row
 * (Postmark keeps base64 bytes in raw_payload; the poller stashes the text it
 * extracted), so a retried resume email still parses the CV and not just the
 * covering note.
 *
 * Approval-gated: the service role bypasses RLS, so re-check the caller here.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireApprovedUser } from "../_shared/auth.ts";
import { processInboundEmail } from "../_shared/emailProcessor.ts";

Deno.serve(withErrorHandling(async (req) => {
  const gate = await requireApprovedUser(req);
  if (gate.response) return gate.response;

  const { email_id, force = false } = await req.json();
  if (!email_id) return errResponse("email_id is required", 400);

  const { data: email, error } = await supabase
    .from("inbound_emails")
    .select("id, workspace_id, processing_status")
    .eq("id", email_id)
    .maybeSingle();

  if (error) return errResponse(error.message, 500);
  if (!email) return errResponse("Inbound email not found", 404);

  // A caller may only reprocess mail in their own workspace. The service role
  // ignores RLS, so this check is the boundary rather than a convenience.
  const callerWorkspace = gate.profile?.workspace_id || null;
  if (callerWorkspace && email.workspace_id && email.workspace_id !== callerWorkspace) {
    return errResponse("Not found", 404);
  }

  // processInboundEmail refuses to touch a row already 'processed' or
  // 'ignored', so clear the terminal state first — that reset is exactly what
  // "reprocess" means. Note this is the only sanctioned way to revive an
  // 'ignored' row: the intake path treats that verdict as final.
  await supabase
    .from("inbound_emails")
    .update({ processing_status: "pending", error_message: null, processed_at: null })
    .eq("id", email_id);

  const result = await processInboundEmail(email_id, { forceCreate: Boolean(force) });

  return okResponse({
    reprocessed: true,
    email_id,
    forced: Boolean(force),
    status: result.status,
    classification: result.classification ?? null,
    confidence: result.confidence ?? null,
    entity: result.entityType ? { type: result.entityType, id: result.entityId } : null,
    approval_item: result.approvalItemId || null,
    error: result.error || null,
  });
}));
