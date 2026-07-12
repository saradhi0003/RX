// Layer 10 (LLM Context): PII must be masked before prompt assembly.
// Tests the browser mirror; supabase/functions/_shared/pii.ts uses the same
// patterns (keep in sync).
import { describe, it, expect } from "vitest";
import { scrubForLLM } from "@/utils/piiScrubber";

describe("scrubForLLM", () => {
  it("masks email addresses", () => {
    expect(scrubForLLM("Reach me at jane.doe+work@example.co.uk today")).toBe(
      "Reach me at [EMAIL] today"
    );
  });

  it("masks US phone numbers in common formats", () => {
    expect(scrubForLLM("Call (415) 555-2671 or 415-555-2671")).toBe(
      "Call [PHONE] or [PHONE]"
    );
    expect(scrubForLLM("Intl: +1 415 555 2671")).toBe("Intl: [PHONE]");
  });

  it("masks SSNs (and not as phone)", () => {
    expect(scrubForLLM("SSN 123-45-6789 on file")).toBe("SSN [SSN] on file");
  });

  it("masks LinkedIn URLs", () => {
    expect(scrubForLLM("Profile: https://www.linkedin.com/in/jane-doe-123")).toBe(
      "Profile: [LINKEDIN]"
    );
  });

  it("leaves names and ordinary text alone", () => {
    const text = "Jane Doe, senior engineer, 8 years of React and Node.js";
    expect(scrubForLLM(text)).toBe(text);
  });

  it("handles null/undefined/empty safely", () => {
    expect(scrubForLLM(null)).toBe("");
    expect(scrubForLLM(undefined)).toBe("");
    expect(scrubForLLM("")).toBe("");
  });

  it("scrubs multiple PII types in one blob", () => {
    const out = scrubForLLM(
      "Jane (jane@x.io, 415-555-2671, https://linkedin.com/in/jane) applied."
    );
    expect(out).toBe("Jane ([EMAIL], [PHONE], [LINKEDIN]) applied.");
  });
});
