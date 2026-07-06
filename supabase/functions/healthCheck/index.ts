// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
/**
 * healthCheck — integrations status endpoint (layer 20: "all API keys return
 * results"). Live-checks every configured provider and reports
 * { ok, message, latency_ms } per service — never key values.
 *
 * Pattern mirrors StockAnalysis app/api/supabase/status: presence checks from
 * the central env module + real connectivity probes with cheap/free endpoints.
 *
 * Deploy:  supabase functions deploy healthCheck
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse } from "../_shared/errorHandler.ts";
import {
  hasOpenAI, getOpenAIKey,
  hasAnthropic, getAnthropicKey,
  hasLiveKit, getLiveKitEnv,
  hasPostmark, getPostmarkToken,
  hasResend, getResendKey,
  envPresence,
} from "../_shared/env.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.9.7";

interface Check {
  ok: boolean;
  message: string;
  latency_ms: number;
  optional?: boolean;
}

const CHECK_TIMEOUT_MS = 5_000;

/** Run a probe with timing + timeout; never throws. */
async function probe(fn: (signal: AbortSignal) => Promise<string>, optional = false): Promise<Check> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const message = await fn(ctrl.signal);
    return { ok: true, message, latency_ms: Date.now() - t0, ...(optional && { optional }) };
  } catch (e) {
    const message = e?.name === "AbortError" ? `timed out after ${CHECK_TIMEOUT_MS}ms`
      : (e instanceof Error ? e.message : String(e));
    return { ok: false, message, latency_ms: Date.now() - t0, ...(optional && { optional }) };
  } finally {
    clearTimeout(timer);
  }
}

const notConfigured = (what: string): Check =>
  ({ ok: false, message: `${what} not configured`, latency_ms: 0, optional: true });

Deno.serve(withErrorHandling(async (_req) => {
  const [database, ai_settings, storage, openai, anthropic, livekit, email] =
    await Promise.all([

      // ── Database connectivity ──
      probe(async () => {
        const { error } = await supabase.from("app_settings").select("key").limit(1);
        if (error) throw new Error(error.message);
        return "connected";
      }),

      // ── AI recruiter settings row exists ──
      probe(async () => {
        const { data } = await supabase
          .from("ai_recruiter_settings").select("id").limit(1).maybeSingle();
        if (!data) throw new Error("no ai_recruiter_settings row");
        return "settings row present";
      }),

      // ── Storage: meeting-recordings bucket ──
      probe(async () => {
        const { data, error } = await supabase.storage.getBucket("meeting-recordings");
        if (error || !data) throw new Error(error?.message || "bucket missing");
        return "meeting-recordings bucket present";
      }),

      // ── OpenAI: key returns results (GET /v1/models is free) ──
      hasOpenAI()
        ? probe(async (signal) => {
            const res = await fetch("https://api.openai.com/v1/models?limit=1", {
              headers: { Authorization: `Bearer ${getOpenAIKey()}` }, signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return "key valid — models listed";
          })
        : Promise.resolve(notConfigured("OPENAI_API_KEY")),

      // ── Anthropic: key returns results (GET /v1/models is free) ──
      hasAnthropic()
        ? probe(async (signal) => {
            const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
              headers: { "x-api-key": getAnthropicKey(), "anthropic-version": "2023-06-01" }, signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return "key valid — models listed";
          })
        : Promise.resolve(notConfigured("ANTHROPIC_API_KEY")),

      // ── LiveKit: mint a token locally (no network; proves keys usable) ──
      hasLiveKit()
        ? probe(async () => {
            const { apiKey, apiSecret } = getLiveKitEnv();
            const at = new AccessToken(apiKey, apiSecret, { identity: "healthcheck", ttl: 60 });
            at.addGrant({ room: "healthcheck", roomJoin: true });
            const jwt = await at.toJwt();
            if (!jwt || jwt.split(".").length !== 3) throw new Error("token mint failed");
            return "token minted";
          })
        : Promise.resolve(notConfigured("LIVEKIT_URL/API_KEY/API_SECRET")),

      // ── Email provider: whichever key exists ──
      hasPostmark()
        ? probe(async (signal) => {
            const res = await fetch("https://api.postmarkapp.com/server", {
              headers: { "X-Postmark-Server-Token": getPostmarkToken(), Accept: "application/json" }, signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return "Postmark token valid";
          })
        : hasResend()
          ? probe(async (signal) => {
              const res = await fetch("https://api.resend.com/domains", {
                headers: { Authorization: `Bearer ${getResendKey()}` }, signal,
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return "Resend key valid";
            })
          : Promise.resolve(notConfigured("POSTMARK_SERVER_TOKEN / RESEND_API_KEY")),
    ]);

  const checks: Record<string, Check> = {
    database, ai_settings, storage, openai, anthropic, livekit, email,
  };

  // Overall status: required checks must pass; optional (unconfigured) ones
  // degrade the report but a missing optional provider isn't an outage.
  const required = Object.values(checks).filter((c) => !c.optional);
  const healthy = required.every((c) => c.ok);
  const allConfiguredOk = Object.values(checks).every((c) => c.ok || c.optional);

  return okResponse(
    {
      status: healthy && allConfiguredOk ? "ok" : healthy ? "degraded" : "down",
      checks,
      env: envPresence(),   // presence booleans only — never values
      timestamp: new Date().toISOString(),
      version: "2.0.0",
    },
    healthy ? 200 : 503
  );
}));
