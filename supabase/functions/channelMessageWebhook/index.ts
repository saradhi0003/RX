/**
 * channelMessageWebhook  (verify_jwt = false)
 * POST { channel_type, external_message_id, sender, sender_name, body, attachments?, raw_payload? }
 * Accepts messages from Telegram/Slack/WhatsApp bots, classifies them,
 * then fires aiRecruiterParseJob or parseResumeFile accordingly.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { classifyMessage } from "../_shared/classifier.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callFunction(name: string, body: unknown) {
  return fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(withErrorHandling(async (req) => {
  const payload = await req.json();
  const {
    channel_type,
    external_message_id,
    sender,
    sender_name,
    body: messageBody,
    attachments = [],
    raw_payload = {},
    channel_connection_id,
  } = payload;

  if (!channel_type || !external_message_id || !messageBody) {
    return errResponse("channel_type, external_message_id, and body are required", 400);
  }

  // Deduplicate — ignore if already received
  const { data: existing } = await supabase
    .from("inbound_channel_messages")
    .select("id")
    .eq("external_message_id", external_message_id)
    .eq("channel_type", channel_type)
    .maybeSingle();

  if (existing) return okResponse({ status: "duplicate", id: existing.id });

  // Store message immediately
  const { data: msg, error: insertErr } = await supabase
    .from("inbound_channel_messages")
    .insert({
      channel_connection_id: channel_connection_id || null,
      channel_type,
      external_message_id,
      sender,
      sender_name,
      body: messageBody,
      attachments,
      raw_payload,
      processing_status: "pending",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) return errResponse(`DB insert failed: ${insertErr.message}`, 500);

  const msgId = msg.id;

  // Classify
  const { classification, confidence } = await classifyMessage(messageBody);

  await supabase
    .from("inbound_channel_messages")
    .update({ classification, classification_confidence: confidence })
    .eq("id", msgId);

  // Route based on classification
  let entityType: string | null = null;
  let entityId: string | null = null;
  let processingError: string | null = null;

  try {
    if (classification === "job") {
      const res = await callFunction("aiRecruiterParseJob", {
        job_description: messageBody,
        source: channel_type,
      });
      if (res.ok) {
        const json = await res.json();
        entityType = "Job";
        entityId = json.job_id;
      } else {
        processingError = `aiRecruiterParseJob failed: ${res.status}`;
      }
    } else if (classification === "resume") {
      const res = await callFunction("parseResumeFile", {
        resume_text: messageBody,
        source: channel_type,
      });
      if (res.ok) {
        const json = await res.json();
        entityType = "Candidate";
        entityId = json.candidate_id;
      } else {
        processingError = `parseResumeFile failed: ${res.status}`;
      }
    }
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
  }

  // Update message with results
  await supabase
    .from("inbound_channel_messages")
    .update({
      processing_status: processingError ? "failed" : entityId ? "processed" : "ignored",
      processed_at: new Date().toISOString(),
      resulting_entity_type: entityType,
      resulting_entity_id: entityId,
      error_message: processingError,
    })
    .eq("id", msgId);

  return okResponse({
    id: msgId,
    classification,
    confidence,
    entity_type: entityType,
    entity_id: entityId,
    error: processingError,
  });
}));
