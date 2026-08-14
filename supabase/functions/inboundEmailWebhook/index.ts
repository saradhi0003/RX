// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals.
/**
 * inboundEmailWebhook  (verify_jwt = false)
 * POST — Postmark Inbound Webhook payload
 * Stores the email, then hands it to _shared/emailProcessor.ts — the same
 * intake path the Gmail/Zoho poller uses (classify → route → create records).
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse } from "../_shared/errorHandler.ts";
import { DEFAULT_WORKSPACE_ID } from "../_shared/auth.ts";
import { processInboundEmail } from "../_shared/emailProcessor.ts";

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

  // Store the inbound email. One Postmark inbound stream serves the whole
  // deployment, so there is no per-message workspace signal — everything lands
  // in the default workspace (per-tenant inbound domains are the future hook).
  const { data: email, error: insertErr } = await supabase
    .from("inbound_emails")
    .insert({
      workspace_id: DEFAULT_WORKSPACE_ID,
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

  // Classify → route → create records (shared with pollEmailInboxes).
  // Postmark attachments arrive base64-inlined in raw_payload; text extraction
  // for those is intentionally left to the poller path for now.
  const result = await processInboundEmail(email.id);

  return okResponse({
    id: email.id,
    classification: result.classification,
    entity: result.entityType ? { type: result.entityType, id: result.entityId } : null,
    approval_item: result.approvalItemId || null,
    stopped_followup: result.stoppedFollowup || false,
    from: fromEmail,
  });
}));
