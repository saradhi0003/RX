/**
 * reprocessChannelMessage
 * POST { message_id: string }
 * Re-runs classification and downstream processing for a failed/ignored channel message.
 */
import { supabase } from "../_shared/supabaseClient.ts";
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
  const body = await req.json();
  const { message_id } = body;

  if (!message_id) return errResponse("message_id is required", 400);

  const { data: msg, error } = await supabase
    .from("inbound_channel_messages")
    .select("*")
    .eq("id", message_id)
    .single();

  if (error || !msg) return errResponse("Message not found", 404);

  // Reset status to pending
  await supabase
    .from("inbound_channel_messages")
    .update({ processing_status: "pending", error_message: null, processed_at: null })
    .eq("id", message_id);

  // Re-fire the webhook processor (reuse channelMessageWebhook logic via self-call)
  const res = await callFunction("channelMessageWebhook", {
    channel_type: msg.channel_type,
    external_message_id: `reprocess-${msg.external_message_id}-${Date.now()}`, // unique ID to avoid dedup
    sender: msg.sender,
    sender_name: msg.sender_name,
    body: msg.body,
    attachments: msg.attachments,
    raw_payload: msg.raw_payload,
    channel_connection_id: msg.channel_connection_id,
  });

  const result = res.ok ? await res.json() : { error: `channelMessageWebhook returned ${res.status}` };

  return okResponse({ reprocessed: true, original_id: message_id, result });
}));
