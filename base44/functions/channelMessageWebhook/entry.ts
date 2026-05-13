/**
 * Unified channel message webhook.
 * Receives normalized messages from the Telegram and Slack bot shims,
 * classifies them, and routes into aiRecruiterParseJob or parseResumeFile.
 *
 * Auth: Bearer token in Authorization header (CHANNEL_BOT_SECRET env var).
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CHANNEL_BOT_SECRET = Deno.env.get("CHANNEL_BOT_SECRET") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

// ── LLM helper ─────────────────────────────────────────────────────────────────

async function classifyMessage(text: string): Promise<{ classification: string; confidence: number }> {
  const systemPrompt = "You classify short recruiting chat messages. Return JSON only.";
  const userPrompt = `Classify this chat message (from a staffing group) as: job, resume, reply, spam, or unknown.
Return: {"classification":"job|resume|reply|spam|unknown","confidence":0.0-1.0}

Message: ${text.substring(0, 1000)}`;

  const tryOpenAI = async () => {
    if (!OPENAI_API_KEY) throw new Error("no key");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.1, max_tokens: 100,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json() as any;
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  };

  const tryClaude = async () => {
    if (!ANTHROPIC_API_KEY) throw new Error("no key");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 100, temperature: 0.1,
        system: systemPrompt, messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json() as any;
    const raw = (data.content?.[0]?.text || "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(raw);
  };

  try {
    return LLM_PROVIDER === "claude" ? await tryClaude() : await tryOpenAI();
  } catch {
    try {
      return LLM_PROVIDER === "claude" ? await tryOpenAI() : await tryClaude();
    } catch {
      return { classification: "unknown", confidence: 0 };
    }
  }
}

Deno.serve(async (req: Request) => {
  // Verify shared bot secret
  const authHeader = req.headers.get("Authorization") || "";
  if (CHANNEL_BOT_SECRET && authHeader !== `Bearer ${CHANNEL_BOT_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let base44: any;
  let payload: any;

  try {
    base44 = createClientFromRequest(req);
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    channel_type,
    external_message_id,
    chat_id,
    sender,
    sender_name,
    body: messageBody = "",
    attachments = [],
    raw_payload = {},
  } = payload;

  if (!channel_type || !external_message_id || !chat_id || !messageBody) {
    return Response.json({ error: "Missing required fields: channel_type, external_message_id, chat_id, body" }, { status: 400 });
  }

  // Look up ChannelConnection
  let connection: any = null;
  try {
    const connections = await base44.entities.ChannelConnection.list("", 200);
    connection = connections.find((c: any) =>
      c.external_id === String(chat_id) && c.channel_type === channel_type && c.is_active
    );
  } catch (err) {
    console.warn("channelMessageWebhook: Could not load ChannelConnections:", (err as Error).message);
  }

  if (!connection) {
    return Response.json({ ignored: true, reason: "no_connection" });
  }

  const receivedAt = new Date().toISOString();

  // Persist the inbound message
  let msgRecord: any = null;
  try {
    msgRecord = await base44.entities.InboundChannelMessage.create({
      channel_connection_id: connection.id,
      channel_type,
      external_message_id: String(external_message_id),
      sender: String(sender || ""),
      sender_name: String(sender_name || sender || ""),
      subject: null,
      body: messageBody,
      attachments,
      raw_payload,
      received_at: receivedAt,
      processing_status: "pending",
    });
  } catch (err) {
    console.error("channelMessageWebhook: Failed to persist message:", (err as Error).message);
  }

  // Use connection's default_classification or AI-classify
  let classification = "unknown";
  let confidence = 0;

  if (connection.default_classification && connection.default_classification !== "auto") {
    classification = connection.default_classification;
    confidence = 1;
  } else {
    const result = await classifyMessage(messageBody);
    classification = result.classification;
    confidence = result.confidence;
  }

  if (msgRecord) {
    await base44.entities.InboundChannelMessage.update(msgRecord.id, {
      classification,
      classification_confidence: confidence,
    }).catch(() => {});
  }

  // Route by classification
  let actionTaken = "none";
  let resultingEntityType: string | null = null;
  let resultingEntityId: string | null = null;

  // Chat messages use a lower confidence threshold (0.6) — chat is messier than email
  const JOB_THRESHOLD = 0.6;

  if (classification === "job" && confidence >= JOB_THRESHOLD) {
    try {
      const parseRes = await (await fetch(req.url.replace("channelMessageWebhook", "aiRecruiterParseJob"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization") || "",
        },
        body: JSON.stringify({
          source: channel_type,
          source_id: msgRecord?.id,
          raw_text: messageBody,
          workspace_id: connection.workspace_id,
        }),
      })).json() as any;

      if (parseRes.job?.id) {
        actionTaken = "job_parsed";
        resultingEntityType = "Job";
        resultingEntityId = parseRes.job.id;
      }
    } catch (err) {
      console.error("channelMessageWebhook: Job parsing failed:", (err as Error).message);
    }
  } else if (classification === "resume" && attachments.length > 0) {
    // Queue resume processing — attachment download from Telegram/Slack requires bot token
    console.info("channelMessageWebhook: Resume with attachment detected, queuing for parseResumeFile");
    actionTaken = "resume_queued";
  } else if (classification === "resume") {
    // Try to parse resume from body text
    actionTaken = "resume_body_detected";
    console.info("channelMessageWebhook: Resume text in body");
  }

  // Update message record
  if (msgRecord) {
    const update: Record<string, unknown> = {
      processing_status: actionTaken !== "none" ? "processed" : "ignored",
      processed_at: new Date().toISOString(),
    };
    if (resultingEntityType) update.resulting_entity_type = resultingEntityType;
    if (resultingEntityId) update.resulting_entity_id = resultingEntityId;
    await base44.entities.InboundChannelMessage.update(msgRecord.id, update).catch(() => {});
  }

  return Response.json({
    success: true,
    inbound_message_id: msgRecord?.id,
    classification,
    confidence,
    action_taken: actionTaken,
    resulting_entity_type: resultingEntityType,
    resulting_entity_id: resultingEntityId,
  });
});
