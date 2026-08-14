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
  //
  // This is two LLM calls plus several writes — far longer than a webhook
  // should hold its caller. Postmark retries on timeout, which would duplicate
  // the work, so acknowledge as soon as the row is durable and let the intake
  // finish in the background. The row is already 'pending', so a crash between
  // the two leaves it reprocessable rather than lost.
  const intake = processInboundEmail(email.id).catch((e) => {
    console.error(`[inboundEmailWebhook] intake failed for ${email.id}:`, e);
  });

  // Supabase's runtime keeps the isolate alive for this; locally (supabase
  // functions serve) there is no EdgeRuntime, so fall back to awaiting.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(intake);
  } else {
    await intake;
  }

  return okResponse({
    id: email.id,
    status: "accepted",
    from: fromEmail,
  });
}));
