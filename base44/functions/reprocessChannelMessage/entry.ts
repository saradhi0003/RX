/**
 * Re-run classification and routing for a failed InboundChannelMessage.
 * Input: { message_id: string }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { message_id } = body;
    if (!message_id) return Response.json({ error: "message_id is required" }, { status: 400 });

    // Load the message
    const messages = await base44.entities.InboundChannelMessage.list("", 500);
    const msg = messages.find((m: any) => m.id === message_id);
    if (!msg) return Response.json({ error: "Message not found" }, { status: 404 });

    // Reset status to pending
    await base44.entities.InboundChannelMessage.update(message_id, {
      processing_status: "pending",
      error_message: null,
    });

    // Re-route based on channel type
    let result: any;
    if (msg.channel_type === "email_inbound") {
      // Re-call inboundEmailWebhook logic inline via channelMessageWebhook
      result = await (await fetch(req.url.replace("reprocessChannelMessage", "channelMessageWebhook"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization") || "",
        },
        body: JSON.stringify({
          channel_type: msg.channel_type,
          external_message_id: msg.external_message_id,
          chat_id: msg.channel_connection_id || "email_inbound",
          sender: msg.sender,
          sender_name: msg.sender_name,
          body: msg.body,
          attachments: msg.attachments || [],
          raw_payload: msg.raw_payload || {},
        }),
      })).json();
    } else {
      result = await (await fetch(req.url.replace("reprocessChannelMessage", "channelMessageWebhook"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization") || "",
        },
        body: JSON.stringify({
          channel_type: msg.channel_type,
          external_message_id: msg.external_message_id,
          chat_id: msg.channel_connection_id,
          sender: msg.sender,
          sender_name: msg.sender_name,
          body: msg.body,
          attachments: msg.attachments || [],
          raw_payload: msg.raw_payload || {},
        }),
      })).json();
    }

    return Response.json({ success: true, message_id, reprocess_result: result });
  } catch (error) {
    console.error("reprocessChannelMessage error:", (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
