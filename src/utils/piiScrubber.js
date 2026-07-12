/**
 * PII scrubbing for LLM prompts — browser mirror of
 * supabase/functions/_shared/pii.ts (keep the two in sync).
 *
 * Masks direct contact identifiers (emails, phones, SSNs, LinkedIn URLs)
 * before free text is interpolated into a prompt via `@/lib/llm`. Names are
 * intentionally left intact — matching/drafting need them.
 */

const PII_PATTERNS = [
  // Order matters: scrub SSN before phone (both are digit runs).
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL]" },
  { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /https?:\/\/(www\.)?linkedin\.com\/[^\s)]+/gi, replacement: "[LINKEDIN]" },
];

/** @param {string | null | undefined} text @returns {string} */
export function scrubForLLM(text) {
  if (!text) return "";
  let result = String(text);
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
