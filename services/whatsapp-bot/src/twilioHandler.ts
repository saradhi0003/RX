import { Request, Response } from "express";
import twilio from "twilio";
import { lookupSender, registerSender } from "./senderRegistry.js";
import { sendChannelMessage, validateRegistrationCode } from "./base44Client.js";
import { shouldForward } from "./classifier.js";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || ""; // whatsapp:+14155238886

const twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);

function normalizePhone(raw: string): string {
  // Strip "whatsapp:" prefix Twilio adds
  return raw.replace(/^whatsapp:/, "");
}

function extractAttachments(body: Record<string, string>): Array<{ url: string; filename: string; mime_type: string }> {
  const attachments: Array<{ url: string; filename: string; mime_type: string }> = [];
  const numMedia = parseInt(body.NumMedia || "0", 10);
  for (let i = 0; i < numMedia; i++) {
    const url = body[`MediaUrl${i}`];
    const mime = body[`MediaContentType${i}`] || "application/octet-stream";
    if (url) {
      const filename = url.split("/").pop() || `attachment_${i}`;
      attachments.push({ url, filename, mime_type: mime });
    }
  }
  return attachments;
}

function twimlResponse(message?: string): string {
  if (!message) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
}

async function sendReply(to: string, message: string) {
  try {
    await twilioClient.messages.create({
      from: TWILIO_NUMBER,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (err) {
    console.error("WhatsApp reply failed:", (err as Error).message);
  }
}

export async function handleWebhook(req: Request, res: Response) {
  // Twilio sends form-encoded POST
  const body = req.body as Record<string, string>;

  const fromRaw = body.From || "";
  const sender = normalizePhone(fromRaw);
  const messageText = (body.Body || "").trim();
  const messageSid = body.MessageSid || body.SmsSid || `wa_${Date.now()}`;
  const attachments = extractAttachments(body);

  // Always respond with empty TwiML quickly (avoid Twilio timeout)
  res.set("Content-Type", "text/xml");

  // REGISTER command: "REGISTER ABC12345"
  const registerMatch = messageText.match(/^REGISTER\s+([A-Z0-9]{6,12})$/i);
  if (registerMatch) {
    const code = registerMatch[1].toUpperCase();
    const result = await validateRegistrationCode(code);
    if (result) {
      registerSender(sender, result.workspace_id, result.channel_connection_id);
      res.send(twimlResponse("✅ Registered! Forward any job post to this number and I'll capture it automatically into Recruiter X."));
    } else {
      res.send(twimlResponse("❌ Invalid or expired registration code. Get a new code at your Recruiter X workspace settings."));
    }
    return;
  }

  // UNREGISTER command
  if (/^UNREGISTER$/i.test(messageText)) {
    const { unregisterSender } = await import("./senderRegistry.js");
    unregisterSender(sender);
    res.send(twimlResponse("Unregistered. You'll no longer forward messages to Recruiter X. Send REGISTER <code> to re-connect."));
    return;
  }

  // STATUS command
  if (/^STATUS$/i.test(messageText)) {
    const reg = lookupSender(sender);
    const msg = reg
      ? "✅ Your number is connected to Recruiter X. Forward job posts and they'll be captured automatically."
      : "❌ Not registered. Get a registration code from your Recruiter X workspace settings and reply: REGISTER <code>";
    res.send(twimlResponse(msg));
    return;
  }

  // HELP / START / unknown command-like messages
  if (/^(HELP|START|HI|HELLO)$/i.test(messageText)) {
    res.send(twimlResponse(
      "👋 Recruiter X WhatsApp Bot\n\n" +
      "• *REGISTER <code>* — Connect your number\n" +
      "• *UNREGISTER* — Disconnect\n" +
      "• *STATUS* — Check connection\n\n" +
      "Get your code at your Recruiter X workspace settings."
    ));
    return;
  }

  // Not registered — send onboarding message
  const registration = lookupSender(sender);
  if (!registration) {
    res.send(twimlResponse(
      "👋 Welcome to Recruiter X. To start forwarding jobs, reply with your registration code:\n\nREGISTER <your-code>\n\nGet a code from your Recruiter X workspace settings."
    ));
    return;
  }

  // Registered — forward if it looks like a job/resume
  // lenient=true because user explicitly forwarded this to us
  if (!messageText && attachments.length === 0) {
    res.send(twimlResponse()); // empty media only — ignore
    return;
  }

  if (messageText && !shouldForward(messageText, true)) {
    res.send(twimlResponse()); // likely a casual chat message
    return;
  }

  // Forward to Base44
  try {
    await sendChannelMessage({
      channel_type: "whatsapp",
      external_message_id: messageSid,
      chat_id: sender,
      sender,
      sender_name: sender, // WhatsApp doesn't share display names via API
      body: messageText,
      attachments,
      raw_payload: body,
    });
    // Don't auto-reply on every forward — keeps quality rating high
    res.send(twimlResponse());
  } catch (err) {
    console.error("WhatsApp: Failed to forward to Base44:", (err as Error).message);
    res.send(twimlResponse());
  }
}
