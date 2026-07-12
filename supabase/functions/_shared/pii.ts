// @ts-nocheck
/**
 * PII scrubbing for LLM prompts (GAPS.md Layer 10).
 *
 * Masks direct contact identifiers before candidate/job text is sent to an
 * external LLM provider. Names are intentionally NOT scrubbed: matching and
 * drafting need them, and a name alone (without contact details) is the
 * accepted trade-off here. Apply to *analytical* context strings (match
 * scoring, classification) — not to fields the model must echo back verbatim
 * into a deliverable the human reviews (e.g. an email's To: address, which
 * never belongs in the prompt anyway).
 *
 * Keep in sync with src/utils/piiScrubber.js (browser mirror).
 */

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Order matters: scrub SSN before phone (both are digit runs).
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL]" },
  { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /https?:\/\/(www\.)?linkedin\.com\/[^\s)]+/gi, replacement: "[LINKEDIN]" },
];

export function scrubForLLM(text: string | null | undefined): string {
  if (!text) return "";
  let result = String(text);
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
