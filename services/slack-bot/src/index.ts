import { App, ExpressReceiver } from "@slack/bolt";
import fetch from "node-fetch";

// Shared keyword classifier (same logic as telegram-bot)
const JOB_KEYWORDS = [
  "requirement", "jd", "looking for", "urgent need", "c2c", "w2", "1099",
  "remote", "onsite", "hiring", "position", "role", "consultant needed",
  "opening", "skills required", "years of experience", "immediate", "/hr",
];
const RESUME_KEYWORDS = [
  "resume", "cv", "looking for job", "open to work", "available for",
  "attached my resume",
];

function isLikelyJobOrResume(text: string): boolean {
  const lower = text.toLowerCase();
  return [...JOB_KEYWORDS, ...RESUME_KEYWORDS].some(kw => lower.includes(kw));
}

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";
const CHANNEL_BOT_SECRET = process.env.CHANNEL_BOT_SECRET || "";
const BASE44_FUNCTIONS_URL = process.env.BASE44_FUNCTIONS_URL || "";
const BASE44_API_KEY = process.env.BASE44_API_KEY || "";
const PORT = parseInt(process.env.PORT || "3001", 10);

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  console.error("SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are required");
  process.exit(1);
}

const receiver = new ExpressReceiver({ signingSecret: SLACK_SIGNING_SECRET, path: "/slack/events" });
const app = new App({ token: SLACK_BOT_TOKEN, receiver });

async function forwardToBase44(payload: {
  channel_type: string;
  external_message_id: string;
  chat_id: string;
  sender: string;
  sender_name: string;
  body: string;
  raw_payload: unknown;
}) {
  const res = await fetch(`${BASE44_FUNCTIONS_URL}/channelMessageWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CHANNEL_BOT_SECRET}`,
      "x-api-key": BASE44_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Listen to messages in channels and groups
app.event("message", async ({ event, client }) => {
  const msg = event as any;

  // Skip bot messages to avoid loops
  if (msg.subtype === "bot_message" || msg.bot_id) return;

  const text = msg.text || "";
  if (!text || !isLikelyJobOrResume(text)) return;

  // Look up user name
  let senderName = msg.user || "";
  try {
    const userInfo = await client.users.info({ user: msg.user });
    senderName = userInfo.user?.real_name || userInfo.user?.name || msg.user;
  } catch { /* non-critical */ }

  try {
    await forwardToBase44({
      channel_type: "slack",
      external_message_id: msg.ts,
      chat_id: msg.channel,
      sender: msg.user,
      sender_name: senderName,
      body: text,
      raw_payload: event,
    });
  } catch (err) {
    console.error("Slack: Failed to forward message:", (err as Error).message);
  }
});

// /recruiterx-register slash command
app.command("/recruiterx-register", async ({ command, ack, respond }) => {
  await ack();

  try {
    const res = await fetch(`${BASE44_FUNCTIONS_URL}/channelMessageWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHANNEL_BOT_SECRET}`,
        "x-api-key": BASE44_API_KEY,
      },
      body: JSON.stringify({
        _action: "register_channel",
        channel_type: "slack",
        external_id: command.channel_id,
        channel_name: command.channel_name,
        workspace_id: command.team_id,
      }),
    });

    const result = await res.json() as any;
    if (result.success || result.ignored) {
      await respond({ text: `Channel <#${command.channel_id}> is now connected to Recruiter X. Job postings will be automatically processed.` });
    } else {
      await respond({ text: `Registration failed: ${result.error || "Unknown error"}` });
    }
  } catch (err) {
    await respond({ text: `Error: ${(err as Error).message}` });
  }
});

// /recruiterx-status slash command
app.command("/recruiterx-status", async ({ command, ack, respond }) => {
  await ack();
  try {
    const res = await fetch(`${BASE44_FUNCTIONS_URL}/channelMessageWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHANNEL_BOT_SECRET}`,
        "x-api-key": BASE44_API_KEY,
      },
      body: JSON.stringify({
        _action: "channel_status",
        channel_type: "slack",
        external_id: command.channel_id,
      }),
    });
    const result = await res.json() as any;
    const stats = result.stats || {};
    await respond({
      text: `*Recruiter X Status for <#${command.channel_id}>*\n• Messages processed: ${stats.processed || 0}\n• Jobs created: ${stats.jobs || 0}\n• Candidates added: ${stats.candidates || 0}`,
    });
  } catch (err) {
    await respond({ text: `Error fetching status: ${(err as Error).message}` });
  }
});

(async () => {
  await app.start(PORT);
  console.log(`Slack bot service listening on port ${PORT}`);
})();
