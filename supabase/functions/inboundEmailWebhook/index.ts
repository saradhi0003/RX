/**
 * inboundEmailWebhook  (verify_jwt = false)
 * POST — Postmark Inbound Webhook payload
 * Stores the email, detects if it's a reply to a tracked outreach,
 * and stops the follow-up sequence if a candidate replied.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { classifyMessage } from "../_shared/classifier.ts";
import { withErrorHandling, okResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (req) => {
  const payload = await req.json();

  // Postmark inbound schema
  const fromEmail: string = payload.From || payload.FromFull?.Email || "";
  const fromName: string = payload.FromName || payload.FromFull?.Name || "";
  const toEmail: string = payload.To || payload.ToFull?.[0]?.Email || "";
  const subject: string = payload.Subject || "";
  const bodyText: string = payload.TextBody || "";
  const bodyHtml: string = payload.HtmlBody || "";
  const messageId: string = payload.MessageID || `inbound-${Date.now()}`;
  const inReplyTo: string = payload.Headers?.find((h: { Name: string }) => h.Name === "In-Reply-To")?.Value || "";
  const attachments: unknown[] = payload.Attachments || [];

  // Deduplicate
  const { data: existing } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing) return okResponse({ status: "duplicate", id: existing.id });

  // Store the inbound email
  const { data: email, error: insertErr } = await supabase
    .from("inbound_emails")
    .insert({
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      message_id: messageId,
      in_reply_to: inReplyTo || null,
      attachments,
      raw_payload: payload,
      received_at: new Date().toISOString(),
      processing_status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !email) {
    return okResponse({ status: "error", message: insertErr?.message });
  }

  const emailId = email.id;

  // Check if this is a reply to one of our tracked threads
  let stoppedFollowup = false;

  if (inReplyTo) {
    // Find a sent email with matching message_id
    const { data: origSent } = await supabase
      .from("sent_emails")
      .select("id, followup_schedule_id, related_entity_id")
      .eq("message_id", inReplyTo)
      .maybeSingle();

    if (origSent?.followup_schedule_id) {
      // Candidate replied — stop the follow-up
      await supabase
        .from("followup_schedules")
        .update({
          status: "stopped",
          last_inbound_reply_at: new Date().toISOString(),
          stop_reason: "candidate_replied",
        })
        .eq("id", origSent.followup_schedule_id);

      stoppedFollowup = true;
    }
  }

  // Classify if not a reply
  let classification = "reply";
  if (!inReplyTo) {
    const result = await classifyMessage(`Subject: ${subject}\n\n${bodyText}`);
    classification = result.classification;
  }

  // Mark as processed
  await supabase
    .from("inbound_emails")
    .update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  return okResponse({
    id: emailId,
    classification,
    stopped_followup: stoppedFollowup,
    from: fromEmail,
  });
}));
