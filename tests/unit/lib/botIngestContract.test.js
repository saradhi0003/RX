import { describe, it, expect } from "vitest";
import {
  secretsMatch,
  storedMessageId,
  validateBotIngestPayload,
  buildInboundEmailRow,
  parseableFiles,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_RAW_PAYLOAD_CHARS,
} from "../../../supabase/functions/_shared/botIngestContract.ts";

const b64 = (s) => Buffer.from(s).toString("base64");

const valid = (over = {}) => ({
  source: "gmail",
  message_id: "18c2f0a1b2",
  from_email: "hiring@acme.com",
  subject: "Senior Java Developer — Dallas, TX",
  body_text: "We are hiring a Senior Java Developer...",
  ...over,
});

describe("botIngestContract — secretsMatch", () => {
  it("accepts only the exact secret", () => {
    expect(secretsMatch("s3cret", "s3cret")).toBe(true);
    expect(secretsMatch("s3creT", "s3cret")).toBe(false);
    expect(secretsMatch("s3cret-and-more", "s3cret")).toBe(false);
    expect(secretsMatch("s3cre", "s3cret")).toBe(false);
  });

  it("never matches a missing header or an unset secret", () => {
    expect(secretsMatch(null, "s3cret")).toBe(false);
    expect(secretsMatch(undefined, "s3cret")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("anything", "")).toBe(false);
  });
});

describe("botIngestContract — storedMessageId", () => {
  it("namespaces like the poller so the two paths dedupe against each other", () => {
    expect(storedMessageId("gmail", "18c2f0a1b2")).toBe("gmail-18c2f0a1b2");
    expect(storedMessageId("zoho", "1700000000123")).toBe("zoho-1700000000123");
    expect(storedMessageId("bot", "abc")).toBe("bot-abc");
  });

  it("does not double-prefix an id that already carries it", () => {
    expect(storedMessageId("gmail", "gmail-18c2f0a1b2")).toBe("gmail-18c2f0a1b2");
  });
});

describe("botIngestContract — validateBotIngestPayload", () => {
  it("accepts a minimal job email and fills defaults", () => {
    const r = validateBotIngestPayload(valid());
    expect(r.ok).toBe(true);
    expect(r.value.files).toEqual([]);
    expect(r.value.workspace_id).toBeNull();
    expect(Date.parse(r.value.received_at)).not.toBeNaN();
  });

  it("rejects non-objects", () => {
    expect(validateBotIngestPayload(null).ok).toBe(false);
    expect(validateBotIngestPayload([]).ok).toBe(false);
    expect(validateBotIngestPayload("hi").ok).toBe(false);
  });

  it("collects every error at once", () => {
    const r = validateBotIngestPayload({ source: "outlook", from_email: "nope" });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^source must be one of/),
        "message_id is required",
        "from_email must be an email address",
      ]),
    );
  });

  it("parses a 'Name <addr>' sender and keeps underscores isPlausibleEmail would reject", () => {
    const r = validateBotIngestPayload(valid({ from_email: '"Doe, Jane" <Jane_Doe@Example.com>' }));
    expect(r.ok).toBe(true);
    expect(r.value.from_email).toBe("jane_doe@example.com");
    expect(r.value.from_name).toBe("Doe, Jane");
  });

  it("prefers an explicit from_name over the header's", () => {
    const r = validateBotIngestPayload(valid({ from_email: "Jane <j@x.com>", from_name: "Jane D." }));
    expect(r.value.from_name).toBe("Jane D.");
  });

  it("refuses an empty message", () => {
    const r = validateBotIngestPayload(valid({ subject: "", body_text: "  ", body_html: "<p> </p>" }));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/message is empty/);
  });

  it("accepts an attachment-only message", () => {
    const r = validateBotIngestPayload(
      valid({
        subject: "",
        body_text: "",
        attachments: [{ filename: "cv.pdf", content_type: "application/pdf", content_base64: b64("%PDF-1.4") }],
      }),
    );
    expect(r.ok).toBe(true);
    expect(Buffer.from(r.value.files[0].bytes).toString()).toBe("%PDF-1.4");
  });

  it("validates uuids and timestamps", () => {
    const r = validateBotIngestPayload(valid({ workspace_id: "ws-1", connection_id: "x", received_at: "yesterday" }));
    expect(r.errors).toEqual(
      expect.arrayContaining([
        "workspace_id must be a UUID",
        "connection_id must be a UUID",
        "received_at must be an ISO-8601 timestamp",
      ]),
    );
    const ok = validateBotIngestPayload(valid({ received_at: "2026-10-28T09:15:00+05:30" }));
    expect(ok.value.received_at).toBe("2026-10-28T03:45:00.000Z");
  });

  it("caps attachments by count, size and encoding", () => {
    const att = { filename: "cv.pdf", content_type: "application/pdf", content_base64: b64("x") };
    expect(
      validateBotIngestPayload(valid({ attachments: Array(MAX_ATTACHMENTS + 1).fill(att) })).errors[0],
    ).toMatch(/at most/);

    const huge = "A".repeat(Math.ceil(((MAX_ATTACHMENT_BYTES + 1024) * 4) / 3 / 4) * 4);
    expect(
      validateBotIngestPayload(valid({ attachments: [{ ...att, content_base64: huge }] })).errors[0],
    ).toMatch(/exceeds/);

    expect(
      validateBotIngestPayload(valid({ attachments: [{ ...att, content_base64: "not base64!" }] })).errors[0],
    ).toMatch(/not valid base64/);

    expect(
      validateBotIngestPayload(valid({ attachments: [{ content_base64: b64("x") }] })).errors[0],
    ).toMatch(/filename or content_type/);
  });

  it("tolerates line-wrapped base64 (MIME wraps at 76 chars)", () => {
    const wrapped = b64("a".repeat(200)).replace(/(.{76})/g, "$1\r\n");
    const r = validateBotIngestPayload(
      valid({ attachments: [{ filename: "a.pdf", content_type: "application/pdf", content_base64: wrapped }] }),
    );
    expect(r.ok).toBe(true);
    expect(r.value.files[0].bytes.length).toBe(200);
  });

  it("gives an extensionless resume the extension attachmentsToText dispatches on", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const r = validateBotIngestPayload(
      valid({ attachments: [{ filename: "resume", content_type: docx, content_base64: b64("PK") }] }),
    );
    expect(r.value.files[0].name).toBe("resume.docx");
  });

  it("bounds raw_payload", () => {
    expect(validateBotIngestPayload(valid({ raw_payload: [1] })).errors).toContain("raw_payload must be a JSON object");
    const big = { blob: "x".repeat(MAX_RAW_PAYLOAD_CHARS) };
    expect(validateBotIngestPayload(valid({ raw_payload: big })).errors[0]).toMatch(/raw_payload exceeds/);
  });
});

describe("botIngestContract — row shape", () => {
  const files = [
    { name: "cv.pdf", contentType: "application/pdf", bytes: new Uint8Array(10) },
    { name: "logo.png", contentType: "image/png", bytes: new Uint8Array(3) },
  ];

  it("keeps only resume-type files for extraction", () => {
    expect(parseableFiles(files).map((f) => f.name)).toEqual(["cv.pdf"]);
  });

  it("stores provenance, metadata only, and nests the caller's payload", () => {
    const { value } = validateBotIngestPayload(valid({ raw_payload: { Attachments: ["spoof"], labels: ["INBOX"] } }));
    const row = buildInboundEmailRow(
      { ...value, files },
      { workspaceId: "ws", emailAccountId: null, attachmentText: "--- cv ---" },
    );
    expect(row).toMatchObject({
      workspace_id: "ws",
      source: "gmail",
      ingest_channel: "bot_ingest",
      message_id: "gmail-18c2f0a1b2",
      processing_status: "pending",
    });
    expect(row.attachments).toEqual([
      { name: "cv.pdf", content_type: "application/pdf", size_bytes: 10 },
      { name: "logo.png", content_type: "image/png", size_bytes: 3 },
    ]);
    // The processor reads raw_payload.Attachments (Postmark) — a bot's own
    // payload must not be able to land there.
    expect(row.raw_payload.Attachments).toBeUndefined();
    expect(row.raw_payload).toEqual({
      ingest: "botIngest",
      provider_payload: { Attachments: ["spoof"], labels: ["INBOX"] },
      extracted_attachment_text: "--- cv ---",
    });
  });
});
