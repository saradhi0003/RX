/**
 * botIngest handler — the real supabase/functions/botIngest/index.ts, run under
 * Vitest with its Deno-only dependencies replaced:
 *   - supabaseClient.ts → an in-memory fake of the handful of PostgREST calls
 *   - emailProcessor.ts / attachmentText.ts → spies (they import npm: modules)
 *   - globalThis.Deno → env + a `serve` that captures the handler
 * env.ts, auth.ts, errorHandler.ts, cors.ts and botIngestContract.ts are real.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const DEFAULT_WS = "00000000-0000-0000-0000-000000000001";
const OTHER_WS = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "33333333-3333-4333-8333-333333333333";
const SECRET = "test-bot-secret";

const h = vi.hoisted(() => {
  const state = {
    tables: {},
    insertError: null,
    countError: null,
    beforeInsert: null,
  };

  /** Just enough of the supabase-js query builder for botIngest. */
  function from(table) {
    const filters = [];
    let op = "select";
    let payload;
    let head = false;
    const run = (single) => {
      const rows = (state.tables[table] ||= []);
      if (op === "insert") {
        state.beforeInsert?.();
        if (state.insertError) return { data: null, error: state.insertError };
        if (rows.some((r) => r.message_id === payload.message_id)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const rec = { id: `row-${rows.length + 1}`, created_at: new Date().toISOString(), ...payload };
        rows.push(rec);
        return { data: { id: rec.id }, error: null };
      }
      const hits = rows.filter((r) => filters.every((f) => f(r)));
      if (head) return { data: null, count: hits.length, error: state.countError };
      return { data: single ? hits[0] ?? null : hits, error: null };
    };
    const b = {
      select(_cols, opts) {
        if (opts?.head) head = true;
        return b;
      },
      eq(col, v) {
        filters.push((r) => r[col] === v);
        return b;
      },
      gte(col, v) {
        filters.push((r) => r[col] >= v);
        return b;
      },
      insert(row) {
        op = "insert";
        payload = row;
        return b;
      },
      maybeSingle: () => Promise.resolve(run(true)),
      single: () => Promise.resolve(run(true)),
      then: (res, rej) => Promise.resolve(run(false)).then(res, rej),
    };
    return b;
  }

  return {
    state,
    supabase: { from },
    processInboundEmail: vi.fn(async () => ({ status: "processed" })),
    attachmentsToText: vi.fn(async (files) => files.map((f) => `--- ${f.name} ---`).join("\n")),
    env: {},
    handler: null,
  };
});

vi.mock("../../../supabase/functions/_shared/supabaseClient.ts", () => ({ supabase: h.supabase }));
vi.mock("../../../supabase/functions/_shared/emailProcessor.ts", () => ({
  processInboundEmail: h.processInboundEmail,
}));
vi.mock("../../../supabase/functions/_shared/attachmentText.ts", () => ({
  attachmentsToText: h.attachmentsToText,
  MAX_ATTACHMENTS_PER_EMAIL: 2,
}));

beforeAll(async () => {
  globalThis.Deno = {
    env: { get: (k) => h.env[k] },
    serve: (fn) => {
      h.handler = fn;
    },
  };
  await import("../../../supabase/functions/botIngest/index.ts");
});

beforeEach(() => {
  h.state.tables = {
    inbound_emails: [],
    workspaces: [{ id: DEFAULT_WS }, { id: OTHER_WS }],
    email_accounts: [
      { id: ACCOUNT, workspace_id: OTHER_WS, provider: "zoho", is_active: true },
    ],
  };
  h.state.insertError = null;
  h.state.countError = null;
  h.state.beforeInsert = null;
  h.env = { BOT_WEBHOOK_SECRET: SECRET };
  h.processInboundEmail.mockClear();
  h.attachmentsToText.mockClear();
});

const URL_ = "https://x.supabase.co/functions/v1/botIngest";

function post(body, { secret = SECRET, raw } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-webhook-secret"] = secret;
  return h.handler(
    new Request(URL_, { method: "POST", headers, body: raw ?? JSON.stringify(body) }),
  );
}

const jobEmail = (over = {}) => ({
  source: "gmail",
  message_id: "18c2f0a1b2",
  from_email: "Hiring Team <hiring@acme.com>",
  subject: "Senior Java Developer — Dallas, TX (C2C)",
  body_text: "We are hiring a Senior Java Developer, 8+ years, Spring Boot, AWS.",
  ...over,
});

describe("botIngest — auth", () => {
  it("fails closed with 503 when BOT_WEBHOOK_SECRET is unset", async () => {
    h.env = {};
    const res = await post(jobEmail());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/BOT_WEBHOOK_SECRET/);
    expect(h.state.tables.inbound_emails).toHaveLength(0);
  });

  it("returns 401 for a missing or wrong secret, and stores nothing", async () => {
    expect((await post(jobEmail(), { secret: null })).status).toBe(401);
    expect((await post(jobEmail(), { secret: "wrong" })).status).toBe(401);
    expect(h.state.tables.inbound_emails).toHaveLength(0);
    expect(h.processInboundEmail).not.toHaveBeenCalled();
  });

  it("checks the secret before even parsing the body", async () => {
    const res = await post(null, { secret: "wrong", raw: "{not json" });
    expect(res.status).toBe(401);
  });

  it("rejects other methods", async () => {
    const res = await h.handler(
      new Request(URL_, { method: "PUT", headers: { "x-webhook-secret": SECRET } }),
    );
    expect(res.status).toBe(405);
  });
});

describe("botIngest — accept + process", () => {
  it("stores the row, acknowledges 202 and hands it to the shared pipeline", async () => {
    const res = await post(jobEmail());
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "accepted",
      message_id: "18c2f0a1b2",
      workspace_id: DEFAULT_WS,
      attachments_extracted: 0,
    });

    const [row] = h.state.tables.inbound_emails;
    expect(row).toMatchObject({
      id: body.id,
      workspace_id: DEFAULT_WS,
      email_account_id: null,
      source: "gmail",
      ingest_channel: "bot_ingest",
      message_id: "gmail-18c2f0a1b2",
      from_email: "hiring@acme.com",
      from_name: "Hiring Team",
      processing_status: "pending",
    });
    // Exactly the call the Postmark webhook and the poller make.
    expect(h.processInboundEmail).toHaveBeenCalledTimes(1);
    expect(h.processInboundEmail).toHaveBeenCalledWith(body.id);
  });

  it("is idempotent on message_id — a replay creates nothing and is not reprocessed", async () => {
    const first = await (await post(jobEmail())).json();
    const res = await post(jobEmail({ subject: "edited on the bot side" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "duplicate",
      id: first.id,
      message_id: "18c2f0a1b2",
      processing_status: "pending",
    });
    expect(h.state.tables.inbound_emails).toHaveLength(1);
    expect(h.processInboundEmail).toHaveBeenCalledTimes(1);
  });

  it("dedupes against mail the Gmail poller already stored (same namespaced id)", async () => {
    h.state.tables.inbound_emails.push({
      id: "polled-1",
      message_id: "gmail-18c2f0a1b2",
      processing_status: "processed",
    });
    const body = await (await post(jobEmail())).json();
    expect(body).toMatchObject({ status: "duplicate", id: "polled-1" });
  });

  it("treats a unique-violation race as a duplicate, not an error", async () => {
    h.state.beforeInsert = () => {
      h.state.tables.inbound_emails.push({ id: "racer", message_id: "gmail-18c2f0a1b2", processing_status: "pending" });
    };
    const res = await post(jobEmail());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "duplicate", id: "racer" });
    expect(h.processInboundEmail).not.toHaveBeenCalled();
  });

  it("extracts resume text at insert time so the row is reprocessable", async () => {
    const res = await post(
      jobEmail({
        source: "zoho",
        message_id: "1700000000123",
        subject: "Application — Data Engineer",
        attachments: [
          { filename: "Jane_Doe_CV.pdf", content_type: "application/pdf", content_base64: Buffer.from("%PDF").toString("base64") },
          { filename: "photo.png", content_type: "image/png", content_base64: Buffer.from("png").toString("base64") },
        ],
      }),
    );
    expect(res.status).toBe(202);
    expect((await res.json()).attachments_extracted).toBe(1);
    expect(h.attachmentsToText).toHaveBeenCalledTimes(1);
    expect(h.attachmentsToText.mock.calls[0][0].map((f) => f.name)).toEqual(["Jane_Doe_CV.pdf"]);

    const [row] = h.state.tables.inbound_emails;
    expect(row.message_id).toBe("zoho-1700000000123");
    expect(row.raw_payload.extracted_attachment_text).toBe("--- Jane_Doe_CV.pdf ---");
    // Bytes are not persisted, only metadata.
    expect(JSON.stringify(row.attachments)).not.toContain("content_base64");
    expect(row.attachments).toHaveLength(2);
  });
});

describe("botIngest — validation", () => {
  it("400s on malformed JSON", async () => {
    const res = await post(null, { raw: "{not json" });
    expect(res.status).toBe(400);
  });

  it("400s with every problem listed", async () => {
    const res = await post({ source: "outlook" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.length).toBeGreaterThanOrEqual(3);
    expect(h.state.tables.inbound_emails).toHaveLength(0);
  });

  it("413s on a declared oversized body without reading it", async () => {
    const res = await h.handler(
      new Request(URL_, {
        method: "POST",
        headers: { "x-webhook-secret": SECRET, "content-length": String(50 * 1024 * 1024) },
        body: "{}",
      }),
    );
    expect(res.status).toBe(413);
  });
});

describe("botIngest — workspace routing", () => {
  it("routes by connection_id and links the mailbox", async () => {
    const res = await post(jobEmail({ source: "zoho", connection_id: ACCOUNT }));
    expect(res.status).toBe(202);
    const [row] = h.state.tables.inbound_emails;
    expect(row.workspace_id).toBe(OTHER_WS);
    expect(row.email_account_id).toBe(ACCOUNT);
  });

  it("refuses a connection that is unknown, disconnected, or another provider", async () => {
    expect((await post(jobEmail({ connection_id: "44444444-4444-4444-8444-444444444444" }))).status).toBe(400);
    expect((await post(jobEmail({ source: "gmail", connection_id: ACCOUNT }))).status).toBe(400);
    h.state.tables.email_accounts[0].is_active = false;
    expect((await post(jobEmail({ source: "zoho", connection_id: ACCOUNT }))).status).toBe(409);
    expect(h.state.tables.inbound_emails).toHaveLength(0);
  });

  it("refuses a connection whose mailbox has no workspace instead of defaulting it", async () => {
    h.state.tables.email_accounts[0].workspace_id = null;
    expect((await post(jobEmail({ source: "zoho", connection_id: ACCOUNT }))).status).toBe(409);
  });

  it("refuses a workspace_id that contradicts the connection", async () => {
    const res = await post(jobEmail({ source: "zoho", connection_id: ACCOUNT, workspace_id: DEFAULT_WS }));
    expect(res.status).toBe(400);
  });

  it("accepts an existing workspace_id and rejects an unknown one", async () => {
    expect((await post(jobEmail({ workspace_id: OTHER_WS }))).status).toBe(202);
    expect(h.state.tables.inbound_emails[0].workspace_id).toBe(OTHER_WS);
    const res = await post(jobEmail({ message_id: "other", workspace_id: "55555555-5555-4555-8555-555555555555" }));
    expect(res.status).toBe(400);
  });
});

describe("botIngest — rate limit", () => {
  const recentBotRows = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      message_id: `bot-r${i}`,
      ingest_channel: "bot_ingest",
      created_at: new Date().toISOString(),
    }));

  it("429s with Retry-After once the per-minute ceiling is reached", async () => {
    h.state.tables.inbound_emails.push(...recentBotRows(60));
    const res = await post(jobEmail());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(h.processInboundEmail).not.toHaveBeenCalled();
  });

  it("still answers duplicates while throttled", async () => {
    h.state.tables.inbound_emails.push(...recentBotRows(60));
    const res = await post(jobEmail({ source: "bot", message_id: "r3" }));
    expect((await res.json()).status).toBe("duplicate");
  });

  it("honours BOT_INGEST_MAX_PER_MINUTE, with 0 disabling the ceiling", async () => {
    h.state.tables.inbound_emails.push(...recentBotRows(5));
    h.env.BOT_INGEST_MAX_PER_MINUTE = "5";
    expect((await post(jobEmail())).status).toBe(429);
    h.env.BOT_INGEST_MAX_PER_MINUTE = "0";
    expect((await post(jobEmail())).status).toBe(202);
  });

  it("ignores old rows and other channels", async () => {
    h.state.tables.inbound_emails.push(
      ...recentBotRows(60).map((r) => ({ ...r, created_at: "2020-01-01T00:00:00.000Z" })),
      ...Array.from({ length: 60 }, (_, i) => ({
        id: `p${i}`, message_id: `pm${i}`, ingest_channel: "postmark_webhook", created_at: new Date().toISOString(),
      })),
    );
    expect((await post(jobEmail())).status).toBe(202);
  });
});

describe("botIngest — migration guard", () => {
  it("503s with the migration to apply when 036 is missing", async () => {
    h.state.countError = { code: "42703", message: 'column "ingest_channel" does not exist' };
    const res = await post(jobEmail());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/036_inbound_email_provenance/);
  });

  it("also catches it at insert when the rate check is disabled", async () => {
    h.env.BOT_INGEST_MAX_PER_MINUTE = "0";
    h.state.insertError = { code: "PGRST204", message: "Could not find the 'ingest_channel' column" };
    const res = await post(jobEmail());
    expect(res.status).toBe(503);
    expect(h.processInboundEmail).not.toHaveBeenCalled();
  });
});

describe("botIngest — status lookup (GET)", () => {
  const get = (qs, secret = SECRET) =>
    h.handler(new Request(`${URL_}?${qs}`, { method: "GET", headers: { "x-webhook-secret": secret } }));

  it("reports where a delivered message got to", async () => {
    h.state.tables.inbound_emails.push({
      id: "e1",
      message_id: "gmail-18c2f0a1b2",
      processing_status: "processed",
      classification: "job",
      classification_confidence: 0.92,
      resulting_entity_type: "job",
      resulting_entity_id: "job-1",
      error_message: null,
    });
    const res = await get("source=gmail&message_id=18c2f0a1b2");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "processed",
      id: "e1",
      classification: "job",
      entity_type: "job",
      entity_id: "job-1",
    });
  });

  it("404s an unknown message, 400s a bad query, 401s without the secret", async () => {
    expect((await get("source=gmail&message_id=nope")).status).toBe(404);
    expect((await get("message_id=x")).status).toBe(400);
    expect((await get("source=gmail&message_id=x", "wrong")).status).toBe(401);
  });
});
