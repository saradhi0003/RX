import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { initDb, handleMessage } from "./botHandler.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || ""; // e.g. https://your-railway-app.railway.app/telegram/webhook

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Initialize DB
initDb();

// Create bot in webhook mode
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Register webhook with Telegram on startup
if (WEBHOOK_URL) {
  bot.setWebHook(WEBHOOK_URL, {
    secret_token: WEBHOOK_SECRET,
  }).then(() => {
    console.log(`Telegram webhook set to ${WEBHOOK_URL}`);
  }).catch(err => {
    console.error("Failed to set Telegram webhook:", err.message);
  });
}

// Telegram webhook endpoint
app.post("/telegram/webhook", async (req, res) => {
  // Verify secret token
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const update = req.body as TelegramBot.Update;
  res.sendStatus(200); // Respond immediately

  // Process asynchronously
  if (update.message) {
    handleMessage(bot, update.message).catch(err => {
      console.error("handleMessage error:", err.message);
    });
  }
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "recruiter-x-telegram-bot" });
});

app.listen(PORT, () => {
  console.log(`Telegram bot service listening on port ${PORT}`);
});
