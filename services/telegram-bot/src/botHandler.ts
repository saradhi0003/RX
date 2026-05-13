import TelegramBot from "node-telegram-bot-api";
import { isLikelyJobOrResume } from "./classifier.js";
import { postToChannelWebhook, createChannelConnection } from "./base44Client.js";
import {
  initDb as _initDb,
  getWorkspaceForChat,
  setWorkspaceForChat,
  removeChat,
  getPendingSetup,
  setPendingSetup,
  clearPendingSetup,
  checkRateLimit,
  getForwardCount,
} from "./connectionStore.js";

export { _initDb as initDb };

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = String(msg.chat.id);
  const userId = String(msg.from?.id || "");
  const text = (msg.text || msg.caption || "").trim();
  const isPrivate = msg.chat.type === "private";

  // ── /start or /setup (DM only) ─────────────────────────────────────────────
  if (isPrivate && (text.startsWith("/start") || text.startsWith("/setup"))) {
    await bot.sendMessage(
      chatId,
      "👋 Welcome to *Recruiter X Bot*!\n\n" +
      "To connect, send your workspace API key. " +
      "Get it from your Recruiter X workspace → Settings → Integrations → Telegram.\n\n" +
      "Then add me to a group and type /register in that group.",
      { parse_mode: "Markdown" }
    );
    setPendingSetup(userId, "await_api_key");
    return;
  }

  // ── /register (group only) ─────────────────────────────────────────────────
  if (!isPrivate && text.startsWith("/register")) {
    const userWs = getWorkspaceForChat(userId); // user's DM workspace
    if (!userWs) {
      await bot.sendMessage(chatId, "⚠️ Please send /setup to me in a private message first.");
      return;
    }
    try {
      const result = await createChannelConnection({
        channel_type: "telegram",
        external_id: chatId,
        channel_name: msg.chat.title || `Telegram ${chatId}`,
        workspace_id: userWs.workspace_id,
      }) as any;
      setWorkspaceForChat(chatId, userWs.workspace_id, {
        connectionId: result?.id,
        chatTitle: msg.chat.title || `Telegram ${chatId}`,
        registeredBy: userId,
      });
      await bot.sendMessage(
        chatId,
        "✅ *Registered!* I'll forward job posts from this group to your Recruiter X workspace.\n\nPost a job description to test it.",
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("botHandler /register error:", (err as Error).message);
      await bot.sendMessage(chatId, "❌ Registration failed. Check your API key and try again.");
    }
    return;
  }

  // ── /unregister (group only) ───────────────────────────────────────────────
  if (!isPrivate && text.startsWith("/unregister")) {
    removeChat(chatId);
    await bot.sendMessage(chatId, "✅ This group has been disconnected from Recruiter X.");
    return;
  }

  // ── /status (any) ──────────────────────────────────────────────────────────
  if (text.startsWith("/status")) {
    const ws = getWorkspaceForChat(isPrivate ? userId : chatId);
    const count = getForwardCount(isPrivate ? userId : chatId);
    if (ws) {
      await bot.sendMessage(
        chatId,
        `✅ *Connected* to Recruiter X\n• Workspace: \`${ws.workspace_id}\`\n• Forwarded this hour: ${count}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot.sendMessage(chatId, "❌ Not registered. Send /setup in a private message to get started.");
    }
    return;
  }

  // ── Handle pending setup steps (DM) ───────────────────────────────────────
  if (isPrivate) {
    const pending = getPendingSetup(userId);
    if (pending?.step === "await_api_key") {
      const apiKey = text.trim();
      if (!apiKey) return;
      setWorkspaceForChat(userId, apiKey);
      clearPendingSetup(userId);
      await bot.sendMessage(
        chatId,
        "✅ *API key saved!*\n\nNow:\n1. Add me to a Telegram group\n2. Type `/register@your_bot_name` in that group",
        { parse_mode: "Markdown" }
      );
      return;
    }
    return; // Ignore other DM messages
  }

  // ── Group message handling ──────────────────────────────────────────────────
  if (!text) return;

  const ws = getWorkspaceForChat(chatId);
  if (!ws) return; // Not registered

  if (!isLikelyJobOrResume(text)) return; // Pre-filter

  // Rate limit check
  if (!checkRateLimit(chatId)) {
    console.warn(`botHandler: Rate limit hit for chat ${chatId}`);
    return;
  }

  try {
    await postToChannelWebhook({
      channel_type: "telegram",
      external_message_id: msg.message_id,
      chat_id: msg.chat.id,
      sender: msg.from?.username || String(msg.from?.id || ""),
      sender_name: `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim(),
      body: text,
      attachments: [],
      raw_payload: msg,
    });
  } catch (err) {
    console.error("botHandler: Failed to forward:", (err as Error).message);
  }
}
