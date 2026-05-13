import "dotenv/config";
import express from "express";
import twilio from "twilio";
import { initDb } from "./senderRegistry.js";
import { handleWebhook } from "./twilioHandler.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL || "";

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  process.exit(1);
}

const app = express();

// Parse Twilio's form-encoded webhook bodies
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Twilio signature validation middleware
const validateTwilio = twilio.webhook({ validate: process.env.NODE_ENV === "production" });

// WhatsApp webhook — Twilio posts here for every inbound message
app.post("/whatsapp/webhook", validateTwilio, handleWebhook);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "recruiter-x-whatsapp-bot",
    webhook_url: WEBHOOK_URL || "not configured",
  });
});

// Initialize DB on startup
initDb();

app.listen(PORT, () => {
  console.log(`WhatsApp bot service listening on port ${PORT}`);
  if (!WEBHOOK_URL) {
    console.warn("WHATSAPP_WEBHOOK_URL not set — configure this in your Twilio console");
  } else {
    console.log(`Set Twilio webhook URL to: ${WEBHOOK_URL}/whatsapp/webhook`);
  }
});
