import { describe, it, expect } from "vitest";
import {
  parseAddressHeader,
  shouldAutoCreate,
  isParseableAttachment,
  decodeBase64Url,
  normalizeGmailMessage,
  normalizeZohoMessage,
  htmlToText,
  CONFIDENCE_THRESHOLD,
  messageIdCandidates,
  normalizeSubject,
  isReplySubject,
  escapeLikePattern,
  isPlausibleEmail,
} from "../../../supabase/functions/_shared/emailNormalizers.ts";

describe("emailNormalizers — address parsing", () => {
  it("parses name + angle-bracket address", () => {
    expect(parseAddressHeader("Jane Doe <jane@example.com>")).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("handles bare addresses, quotes, and empties", () => {
    expect(parseAddressHeader("jane@example.com")).toEqual({ name: "", email: "jane@example.com" });
    expect(parseAddressHeader('"Doe, Jane" <JANE@example.com>').email).toBe("jane@example.com");
    expect(parseAddressHeader("")).toEqual({ name: "", email: "" });
    expect(parseAddressHeader(undefined)).toEqual({ name: "", email: "" });
  });
});

describe("emailNormalizers — confidence gate", () => {
  it("auto-creates job/resume at or above the threshold", () => {
    expect(shouldAutoCreate("job", CONFIDENCE_THRESHOLD)).toBe(true);
    expect(shouldAutoCreate("resume", 0.95)).toBe(true);
  });

  it("queues low-confidence or non-record classifications for review", () => {
    expect(shouldAutoCreate("job", CONFIDENCE_THRESHOLD - 0.01)).toBe(false);
    expect(shouldAutoCreate("resume", 0)).toBe(false);
    expect(shouldAutoCreate("spam", 1)).toBe(false);
    expect(shouldAutoCreate("reply", 1)).toBe(false);
    expect(shouldAutoCreate("unknown", 1)).toBe(false);
  });
});

describe("emailNormalizers — attachment filter", () => {
  it("accepts PDF and DOCX by name or MIME type", () => {
    expect(isParseableAttachment("resume.pdf", "")).toBe(true);
    expect(isParseableAttachment("CV.DOCX", "")).toBe(true);
    expect(isParseableAttachment("file", "application/pdf")).toBe(true);
    expect(
      isParseableAttachment(
        "file",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isParseableAttachment("photo.png", "image/png")).toBe(false);
    expect(isParseableAttachment("notes.txt", "text/plain")).toBe(false);
    expect(isParseableAttachment("", "")).toBe(false);
  });
});

describe("emailNormalizers — Gmail mapping", () => {
  const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_");

  it("maps a full Gmail message to the inbound row shape", () => {
    const msg = {
      id: "abc123",
      threadId: "t1",
      internalDate: "1754800000000",
      payload: {
        headers: [
          { name: "From", value: "Rita Recruiter <rita@client.com>" },
          { name: "To", value: "me@talentstack.io" },
          { name: "Subject", value: "Java role - NYC" },
          { name: "In-Reply-To", value: "<orig@mail>" },
        ],
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", body: { data: b64url("Need a Java dev") } },
          { mimeType: "text/html", body: { data: b64url("<p>Need a Java dev</p>") } },
          {
            mimeType: "application/pdf",
            filename: "JD.pdf",
            body: { attachmentId: "att-1" },
          },
        ],
      },
    };

    const row = normalizeGmailMessage(msg, "acct-1");
    expect(row.from_email).toBe("rita@client.com");
    expect(row.from_name).toBe("Rita Recruiter");
    expect(row.to_email).toBe("me@talentstack.io");
    expect(row.subject).toBe("Java role - NYC");
    expect(row.body_text).toBe("Need a Java dev");
    expect(row.body_html).toBe("<p>Need a Java dev</p>");
    expect(row.message_id).toBe("gmail-abc123");
    expect(row.in_reply_to).toBe("<orig@mail>");
    expect(row.attachments).toEqual([
      { name: "JD.pdf", contentType: "application/pdf", attachmentId: "att-1" },
    ]);
    expect(row.received_at).toBe(new Date(1754800000000).toISOString());
    expect(row.email_account_id).toBe("acct-1");
  });

  it("round-trips base64url bodies including UTF-8", () => {
    expect(decodeBase64Url(b64url("Café résumé — senior"))).toBe("Café résumé — senior");
    expect(decodeBase64Url("")).toBe("");
  });

  it("handles a message with no headers or parts without throwing", () => {
    const row = normalizeGmailMessage({ id: "x" }, "acct-1");
    expect(row.message_id).toBe("gmail-x");
    expect(row.subject).toBe("");
    expect(row.attachments).toEqual([]);
    expect(row.in_reply_to).toBeNull();
  });
});

describe("emailNormalizers — Zoho mapping", () => {
  it("maps a Zoho message + content to the inbound row shape", () => {
    const msg = {
      messageId: 987654321,
      subject: "Resume — Priya Sharma",
      fromAddress: "Priya Sharma <priya@example.com>",
      toAddress: "me@talentstack.io",
      receivedTime: "1754800000000",
      attachments: [{ attachmentName: "Priya_Resume.docx", attachmentId: 55 }],
    };

    const row = normalizeZohoMessage(msg, "<p>Hi, attaching my resume</p>", "acct-2");
    expect(row.from_email).toBe("priya@example.com");
    expect(row.from_name).toBe("Priya Sharma");
    expect(row.subject).toBe("Resume — Priya Sharma");
    expect(row.body_html).toBe("<p>Hi, attaching my resume</p>");
    expect(row.message_id).toBe("zoho-987654321");
    expect(row.attachments).toEqual([
      { name: "Priya_Resume.docx", contentType: "", attachmentId: "55" },
    ]);
    expect(row.email_account_id).toBe("acct-2");
  });
});

describe("emailNormalizers — htmlToText", () => {
  it("strips tags, scripts, styles and entities", () => {
    const html = `<style>.a{color:red}</style><p>Hello <b>world</b></p><script>evil()</script>&nbsp;&amp;`;
    expect(htmlToText(html)).toBe("Hello world &");
  });

  it("is safe on empty input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined)).toBe("");
  });
});

describe("emailNormalizers — reply threading", () => {
  // Postmark's send API returns a bare GUID, which is what lands in
  // sent_emails.message_id; the recipient's client echoes back the full
  // <guid@mtasv.net>. Matching one against the other is what makes
  // stop-on-reply work at all.
  it("offers the bare, bracketed and local-part forms of a message id", () => {
    const forms = messageIdCandidates("<abc-123@mtasv.net>");
    expect(forms).toContain("abc-123@mtasv.net");
    expect(forms).toContain("<abc-123@mtasv.net>");
    expect(forms).toContain("abc-123");
  });

  it("takes every id when a client echoes a chain, and dedupes", () => {
    const forms = messageIdCandidates("<one@x.com> <two@x.com>");
    expect(forms).toContain("one@x.com");
    expect(forms).toContain("two@x.com");
    expect(new Set(forms).size).toBe(forms.length);
  });

  it("handles an unbracketed header and empty input", () => {
    expect(messageIdCandidates("plain-guid")).toContain("plain-guid");
    expect(messageIdCandidates("")).toEqual([]);
    expect(messageIdCandidates(null)).toEqual([]);
  });

  it("strips reply and forward prefixes down to a comparable subject", () => {
    expect(normalizeSubject("Re: Senior Dev")).toBe("senior dev");
    expect(normalizeSubject("RE: Fwd:  Senior   Dev")).toBe("senior dev");
    expect(normalizeSubject("Re[2]: Senior Dev")).toBe("senior dev");
    expect(normalizeSubject("Senior Dev")).toBe("senior dev");
  });

  it("detects reply subjects — the Zoho fallback depends on it", () => {
    expect(isReplySubject("Re: hello")).toBe(true);
    expect(isReplySubject("FWD: hello")).toBe(true);
    expect(isReplySubject("hello")).toBe(false);
    expect(isReplySubject("")).toBe(false);
  });
});

describe("emailNormalizers — lookup-key hardening", () => {
  // from_email is attacker-controlled: an unescaped % turns the candidate
  // lookup into a wildcard that matches somebody else's record, which the
  // sender's "resume" then overwrites.
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("%@example.com")).toBe("\\%@example.com");
    expect(escapeLikePattern("a_b@example.com")).toBe("a\\_b@example.com");
    expect(escapeLikePattern("jane@example.com")).toBe("jane@example.com");
  });

  it("rejects anything that is not a single plain address", () => {
    expect(isPlausibleEmail("jane@example.com")).toBe(true);
    expect(isPlausibleEmail("%@example.com")).toBe(false);
    expect(isPlausibleEmail("a_b@example.com")).toBe(false);
    expect(isPlausibleEmail("jane@example.com, bob@example.com")).toBe(false);
    expect(isPlausibleEmail("not-an-email")).toBe(false);
    expect(isPlausibleEmail("")).toBe(false);
  });
});
