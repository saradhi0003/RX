/**
 * System health check endpoint.
 * Verifies LLM connectivity and Postmark API key.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const POSTMARK_SERVER_TOKEN = Deno.env.get("POSTMARK_SERVER_TOKEN");

Deno.serve(async (req: Request) => {
  const checks: Record<string, { ok: boolean; message: string }> = {};

  // OpenAI check
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      });
      checks.openai = { ok: res.ok, message: res.ok ? "Connected" : `Status ${res.status}` };
    } catch (err) {
      checks.openai = { ok: false, message: (err as Error).message };
    }
  } else {
    checks.openai = { ok: false, message: "OPENAI_API_KEY not configured" };
  }

  // Anthropic check
  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      checks.anthropic = { ok: res.ok, message: res.ok ? "Connected" : `Status ${res.status}` };
    } catch (err) {
      checks.anthropic = { ok: false, message: (err as Error).message };
    }
  } else {
    checks.anthropic = { ok: false, message: "ANTHROPIC_API_KEY not configured" };
  }

  // Postmark check (validate token by hitting /server — no email sent)
  if (POSTMARK_SERVER_TOKEN) {
    try {
      const res = await fetch("https://api.postmarkapp.com/server", {
        headers: { "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN },
      });
      checks.postmark = { ok: res.ok, message: res.ok ? "Connected" : `Status ${res.status}` };
    } catch (err) {
      checks.postmark = { ok: false, message: (err as Error).message };
    }
  } else {
    checks.postmark = { ok: false, message: "POSTMARK_SERVER_TOKEN not configured" };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  const status = allOk ? "healthy" : "degraded";

  return Response.json({ status, checks, timestamp: new Date().toISOString() });
});
