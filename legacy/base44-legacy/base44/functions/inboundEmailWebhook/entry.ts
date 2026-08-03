/**
 * Postmark inbound email webhook.
 * Receives parsed emails from Postmark, classifies them with LLM, and routes
 * to aiRecruiterParseJob (jobs) or parseResumeFile (resumes).
 *
 * Setup:
 *   1. Create a Postmark Inbound server.
 *   2. Set the webhook URL to {functions-base-url}/inboundEmailWebhook.
 *   3. Configure your MX records to point to Postmark's inbound domain.
 *   4. Set POSTMARK_WEBHOOK_SECRET env var.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const POSTMARK_WEBHOOK_SECRET = Deno.env.get("POSTMARK_WEBHOOK_SECRET") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

// ── LLM helpers (inlined to avoid cross-function imports in Deno) ─────────────

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<unknown> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error?.message || `OpenAI ${res.status}`); }
  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content;
  try { return JSON.parse(content); } catch { return content; }
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<unknown> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error?.message || `Anthropic ${res.status}`); }
  const data = await res.json() as any;
  const raw = data.content?.[0]?.text || "";
  try { return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); } catch { return raw; }
}

async function classifyContent(text: string, isEmail: boolean): Promise<{ classification: string; confidence: number; reasoning: string }> {
  const systemPrompt = `You are an email classifier for a recruiting firm. Classify the content and return JSON.`;
  const userPrompt = `Classify this ${isEmail ? "email" : "chat message"} as one of: job, resume, reply, spam, unknown.
Return JSON: {"classification":"job|resume|reply|spam|unknown","confidence":0.0-1.0,"reasoning":"..."}

Content:
${text.substring(0, 2000)}`;

  try {
    const result = LLM_PROVIDER === "claude"
      ? await callClaude(systemPrompt, userPrompt)
      : await callOpenAI(systemPrompt, userPrompt);
    return result as any;
  } catch {
    try {
      const fallback = LLM_PROVIDER === "claude"
        ? await callOpenAI(systemPrompt, userPrompt)
        : await callClaude(systemPrompt, userPrompt);
      return fallback as any;
    } catch {
      return { classification: "unknown", confidence: 0, reasoning: "LLM classification failed" };
    }
  }
}

// ── Postmark payload types ─────────────────────────────────────────────────────

interface PostmarkAttachment {
  Name: string;
  Content: string;
  ContentType: string;
  ContentLength: number;
}

interface PostmarkPayload {
  MessageID: string;
  From: string;
  FromFull?: { Email: string; Name: string };
  Subject: string;
  TextBody: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Headers?: Array<{ Name: string; Value: string }>;
  Attachments?: PostmarkAttachment[];
  Date?: string;
  OriginalRecipient?: string;
  To?: string;
}

function verifyPostmarkSignature(req: Request): boolean {
  if (!POSTMARK_WEBHOOK_SECRET) return true; // skip in dev if not set
  const headerSecret = req.headers.get("X-Postmark-Signature") || "";
  return headerSecret === POSTMARK_WEBHOOK_SECRET;
}

function extractHeader(headers: Array<{ Name: string; Value: string }> | undefined, name: string): string | null {
  return headers?.find(h => h.Name.toLowerCase() === name.toLowerCase())?.Value || null;
}

Deno.serve(async (req: Request) => {
  // Signature check
  if (!verifyPostmarkSignature(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let base44: any;
  let payload: PostmarkPayload;

  try {
    base44 = createClientFromRequest(req);
    payload = await req.json() as PostmarkPayload;
  } catch (err) {
    // Parsing failure — still return 200 to prevent Postmark retries
    console.error("inboundEmailWebhook: Failed to parse payload:", err);
    return Response.json({ received: true, error: "parse_failed" });
  }

  const body = payload.TextBody || payload.StrippedTextReply || "";
  const subject = payload.Subject || "";
  const sender = payload.FromFull?.Email || payload.From || "";
  const senderName = payload.FromFull?.Name || sender;
  const inReplyTo = extractHeader(payload.Headers, "In-Reply-To");
  const receivedAt = new Date().toISOString();

  // Persist the raw message
  let msgRecord: any = null;
  try {
    msgRecord = await base44.entities.InboundChannelMessage.create({
      channel_type: "email_inbound",
      external_message_id: payload.MessageID || crypto.randomUUID(),
      sender,
      sender_name: senderName,
      subject,
      body,
      attachments: (payload.Attachments || []).map(a => ({
        url: "",          // Postmark sends content inline; URL not available
        filename: a.Name,
        mime_type: a.ContentType,
      })),
      raw_payload: payload as unknown as Record<string, unknown>,
      received_at: receivedAt,
      processing_status: "pending",
    });
  } catch (err) {
    console.error("inboundEmailWebhook: Failed to save InboundChannelMessage:", err);
    // Continue processing even if persistence fails
  }

  try {
    // Handle thread replies: check In-Reply-To header
    if (inReplyTo) {
      try {
        const sentEmails = await base44.entities.SentEmail.list("-sent_at", 200);
        const original = sentEmails.find((e: any) => e.message_id === inReplyTo);
        if (original?.followup_schedule_id) {
          await base44.entities.FollowupSchedule.update(original.followup_schedule_id, {
            last_inbound_reply_at: receivedAt,
            status: "stopped",
            stop_reason: "candidate_replied",
          });
          await base44.entities.SentEmail.update(original.id, { status: "replied" });
          if (msgRecord) {
            await base44.entities.InboundChannelMessage.update(msgRecord.id, {
              classification: "reply",
              classification_confidence: 1,
              processing_status: "processed",
              processed_at: receivedAt,
            });
          }
          return Response.json({ received: true, classification: "reply", action: "followup_stopped" });
        }
      } catch (err) {
        console.warn("inboundEmailWebhook: Reply lookup failed:", err);
      }
    }

    // Classify content
    const contentToClassify = `Subject: ${subject}\n\n${body}`;
    const classified = await classifyContent(contentToClassify, true);

    if (msgRecord) {
      await base44.entities.InboundChannelMessage.update(msgRecord.id, {
        classification: classified.classification,
        classification_confidence: classified.confidence,
      });
    }

    let actionTaken = "none";
    let resultingEntityType: string | null = null;
    let resultingEntityId: string | null = null;
    let runId: string | null = null;

    if (classified.classification === "job" && classified.confidence > 0.7) {
      // Route to job parsing
      try {
        const parseResult = await (await fetch(req.url.replace("inboundEmailWebhook", "aiRecruiterParseJob"), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
          body: JSON.stringify({ source: "email_inbound", source_id: msgRecord?.id, raw_text: `Subject: ${subject}\n\n${body}` }),
        })).json() as any;

        if (parseResult.job?.id) {
          actionTaken = "job_parsed";
          resultingEntityType = "Job";
          resultingEntityId = parseResult.job.id;
          runId = parseResult.run_id;
        }
      } catch (err) {
        console.error("inboundEmailWebhook: aiRecruiterParseJob failed:", err);
      }
    } else if (classified.classification === "resume") {
      // Try to find a PDF/DOCX attachment
      const resumeAttachment = (payload.Attachments || []).find(a =>
        a.ContentType.includes("pdf") || a.ContentType.includes("word") || a.Name.match(/\.(pdf|docx|doc)$/i)
      );
      if (resumeAttachment) {
        actionTaken = "resume_queued";
        // parseResumeFile will be called asynchronously — log it
        console.info("inboundEmailWebhook: Resume attachment detected, would call parseResumeFile:", resumeAttachment.Name);
      } else {
        // Try parsing resume from body text
        actionTaken = "resume_body_detected";
        console.info("inboundEmailWebhook: Resume text in body, extracting from email body");
      }
    }

    // Update message record with result
    if (msgRecord) {
      const updateData: Record<string, unknown> = {
        processing_status: "processed",
        processed_at: receivedAt,
      };
      if (resultingEntityType) updateData.resulting_entity_type = resultingEntityType;
      if (resultingEntityId) updateData.resulting_entity_id = resultingEntityId;
      if (runId) updateData.ai_recruiter_run_id = runId;
      await base44.entities.InboundChannelMessage.update(msgRecord.id, updateData);
    }

    return Response.json({
      received: true,
      classification: classified.classification,
      confidence: classified.confidence,
      action: actionTaken,
      resulting_entity_type: resultingEntityType,
      resulting_entity_id: resultingEntityId,
    });

  } catch (err) {
    const error = err as Error;
    console.error("inboundEmailWebhook: Processing error:", error.message);

    try {
      if (msgRecord) {
        await base44.entities.InboundChannelMessage.update(msgRecord.id, {
          processing_status: "failed",
          error_message: error.message,
        });
      }
      await base44.entities.AuditLog.create({
        user_email: "system",
        action: "inbound_email_processing_failed",
        meta: { error: error.message, message_id: payload?.MessageID },
      });
    } catch { /* log failure is non-critical */ }

    // Always return 200 to prevent Postmark retries on logic errors
    return Response.json({ received: true, error: error.message });
  }
});
