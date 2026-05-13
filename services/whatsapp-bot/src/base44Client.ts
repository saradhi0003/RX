import axios, { AxiosInstance } from "axios";

const BASE44_FUNCTIONS_URL = process.env.BASE44_FUNCTIONS_URL || "";
const CHANNEL_BOT_SECRET = process.env.CHANNEL_BOT_SECRET || "";
const BASE44_API_KEY = process.env.BASE44_API_KEY || "";

const client: AxiosInstance = axios.create({
  baseURL: BASE44_FUNCTIONS_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CHANNEL_BOT_SECRET}`,
    "x-api-key": BASE44_API_KEY,
  },
  timeout: 15000,
});

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: Error;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status && status < 500) throw err; // don't retry 4xx
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr!;
}

export async function sendChannelMessage(payload: {
  channel_type: string;
  external_message_id: string;
  chat_id: string;
  sender: string;
  sender_name: string;
  body: string;
  attachments?: Array<{ url: string; filename: string; mime_type: string }>;
  raw_payload: unknown;
}): Promise<unknown> {
  return withRetry(async () => {
    const res = await client.post("/channelMessageWebhook", payload);
    return res.data;
  });
}

export async function validateRegistrationCode(code: string): Promise<{ workspace_id: string; channel_connection_id: string } | null> {
  try {
    const res = await client.post("/validateWhatsappRegistrationCode", { code });
    if (res.data?.workspace_id) return res.data;
    return null;
  } catch {
    return null;
  }
}
