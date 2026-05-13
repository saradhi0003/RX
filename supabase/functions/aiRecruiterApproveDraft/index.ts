/**
 * aiRecruiterApproveDraft
 * POST { draft_id, approved_by?: string }
 * Marks a draft as approved. If send_immediately_on_approval is enabled,
 * calls sendApprovedDraft inline; otherwise just updates status.
 */
import { supabase, getAISettings, getSetting } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { draft_id, approved_by = "human" } = body;

  if (!draft_id) return errResponse("draft_id is required", 400);

  // Fetch the draft
  const { data: draft, error: draftErr } = await supabase
    .from("email_drafts")
    .select("id, status, run_id, job_id, to_email, subject, body")
    .eq("id", draft_id)
    .single();

  if (draftErr || !draft) return errResponse("Draft not found", 404);
  if (draft.status === "sent") return errResponse("Draft already sent", 409);

  // Mark as approved
  await supabase
    .from("email_drafts")
    .update({ status: "approved", approved_by, approved_at: new Date().toISOString() })
    .eq("id", draft_id);

  const aiSettings = await getAISettings();
  const sendImmediately = aiSettings?.send_immediately_on_approval ?? false;

  let sent = false;
  let messageId: string | null = null;

  if (sendImmediately && draft.to_email) {
    // Inline send via Postmark
    const postmarkToken = await getSetting("postmark_token");
    const fromEmail = await getSetting("from_email");

    if (postmarkToken && fromEmail) {
      const pmRes = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": postmarkToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: fromEmail,
          To: draft.to_email,
          Subject: draft.subject,
          TextBody: draft.body,
          MessageStream: "outbound",
        }),
      });

      if (pmRes.ok) {
        const pmJson = await pmRes.json();
        messageId = pmJson.MessageID || null;

        // Record sent email
        await supabase.from("sent_emails").insert({
          draft_id,
          to_email: draft.to_email,
          subject: draft.subject,
          body: draft.body,
          message_id: messageId,
          provider: "postmark",
          provider_message_id: messageId,
          status: "sent",
        });

        // Mark draft as sent
        await supabase.from("email_drafts").update({ status: "sent" }).eq("id", draft_id);

        sent = true;
      }
    }
  }

  await supabase.from("recruiter_activities").insert({
    run_id: draft.run_id || null,
    entity_type: "email",
    activity_type: "ai_email_draft_approved",
    title: `Draft approved${sent ? " and sent" : ""}`,
    description: `Draft ID: ${draft_id} | To: ${draft.to_email || "N/A"} | Auto-sent: ${sent}`,
  });

  return okResponse({ draft_id, approved: true, sent, message_id: messageId });
}));
