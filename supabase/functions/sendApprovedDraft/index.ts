/**
 * sendApprovedDraft
 * POST { draft_id, in_reply_to?: string, thread_message_id?: string }
 * Sends an approved email draft via Postmark and records it in sent_emails.
 */
import { supabase, getSetting } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { draft_id, in_reply_to, thread_message_id } = body;

  if (!draft_id) return errResponse("draft_id is required", 400);

  // Fetch draft — must be in approved state
  const { data: draft, error } = await supabase
    .from("email_drafts")
    .select("id, status, run_id, job_id, to_email, cc, subject, body")
    .eq("id", draft_id)
    .single();

  if (error || !draft) return errResponse("Draft not found", 404);
  if (draft.status === "sent") return errResponse("Draft already sent", 409);
  if (draft.status !== "approved") return errResponse(`Draft is in '${draft.status}' state, must be 'approved'`, 409);
  if (!draft.to_email) return errResponse("Draft has no recipient email", 400);

  const postmarkToken = await getSetting("postmark_token");
  const fromEmail = await getSetting("from_email");

  if (!postmarkToken) return errResponse("Postmark token not configured", 503);
  if (!fromEmail) return errResponse("From email not configured", 503);

  // Idempotency lock: atomically claim the draft (approved → sending) so a
  // double-click or retried invocation can't send twice. The status check
  // above is only advisory — this conditional update is the real gate.
  const { data: claimed } = await supabase
    .from("email_drafts")
    .update({ status: "sending" })
    .eq("id", draft_id)
    .eq("status", "approved")
    .select("id");
  if (!claimed?.length) return errResponse("Draft is already being sent by another request", 409);

  // Build Postmark payload
  const payload: Record<string, unknown> = {
    From: fromEmail,
    To: draft.to_email,
    Subject: draft.subject,
    TextBody: draft.body,
    MessageStream: "outbound",
  };

  if (draft.cc) payload.Cc = draft.cc;

  // RFC 822 threading headers
  const headers: Array<{ Name: string; Value: string }> = [];
  if (in_reply_to) headers.push({ Name: "In-Reply-To", Value: in_reply_to });
  if (thread_message_id) headers.push({ Name: "References", Value: thread_message_id });
  if (headers.length) payload.Headers = headers;

  let pmRes: Response;
  let pmJson: { Message?: string; MessageID?: string };
  try {
    pmRes = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": postmarkToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    pmJson = await pmRes.json();
  } catch (netErr) {
    // Release the lock so a retry is possible — nothing was sent.
    await supabase.from("email_drafts").update({ status: "approved" }).eq("id", draft_id);
    return errResponse(`Postmark unreachable: ${netErr?.message || netErr}`, 502);
  }
  if (!pmRes.ok) {
    await supabase.from("email_drafts").update({ status: "send_failed", send_failed_reason: pmJson.Message }).eq("id", draft_id);
    return errResponse(`Postmark error: ${pmJson.Message}`, 502);
  }

  const messageId = pmJson.MessageID || null;

  // Record in sent_emails
  await supabase.from("sent_emails").insert({
    draft_id,
    to_email: draft.to_email,
    subject: draft.subject,
    body: draft.body,
    message_id: messageId,
    in_reply_to: in_reply_to || null,
    thread_id: thread_message_id || messageId,
    provider: "postmark",
    provider_message_id: messageId,
    status: "sent",
  });

  // Mark draft as sent
  await supabase.from("email_drafts").update({ status: "sent" }).eq("id", draft_id);

  await supabase.from("recruiter_activities").insert({
    run_id: draft.run_id || null,
    entity_type: "email",
    activity_type: "ai_email_draft_approved",
    title: "Email sent via Postmark",
    description: `To: ${draft.to_email} | Message-ID: ${messageId}`,
  });

  return okResponse({ sent: true, message_id: messageId, to: draft.to_email });
}));
