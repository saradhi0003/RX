import fetch from "node-fetch";

const BASE44_FUNCTIONS_URL = process.env.BASE44_FUNCTIONS_URL || "";
const BASE44_API_KEY = process.env.BASE44_API_KEY || "";
const CHANNEL_BOT_SECRET = process.env.CHANNEL_BOT_SECRET || "";

export async function postToChannelWebhook(payload: {
  channel_type: string;
  external_message_id: string | number;
  chat_id: string | number;
  sender: string;
  sender_name: string;
  body: string;
  attachments?: Array<{ url: string; filename: string; mime_type: string }>;
  raw_payload: unknown;
}): Promise<unknown> {
  const url = `${BASE44_FUNCTIONS_URL}/channelMessageWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CHANNEL_BOT_SECRET}`,
      "x-api-key": BASE44_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`channelMessageWebhook failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function createChannelConnection(payload: {
  channel_type: string;
  external_id: string;
  channel_name: string;
  workspace_id?: string;
}): Promise<unknown> {
  const url = `${BASE44_FUNCTIONS_URL}/createChannelConnection`;
  const res = await fetch(url, {
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
