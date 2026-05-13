const JOB_KEYWORDS = [
  "requirement", "requirements", "jd", "job description",
  "looking for", "urgent need", "urgently need", "urgent hiring",
  "c2c", "corp to corp", "w2", "w-2", "1099",
  "remote", "onsite", "on-site", "hybrid",
  "hiring", "position", "role",
  "consultant needed", "consultants needed",
  "opening", "openings", "vacancy",
  "skills required", "skill set",
  "years of experience", "yoe",
  "must have", "immediate", "asap",
  "/hr", "per hour", "per year", "per annum",
  "h1b", "gc", "usc", "citizen", "green card",
  "visa", "work authorization",
];

const RESUME_KEYWORDS = [
  "resume", "cv", "curriculum vitae",
  "looking for job", "looking for opportunity",
  "available for", "open to work",
  "years experience", "yrs experience",
  "attached my resume", "please review", "please find attached",
  "my profile", "my background",
];

export function shouldForward(text: string, lenient = false): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Always forward long messages in lenient mode (user explicitly sent it)
  if (lenient && text.length > 150) return true;
  // Always forward very long messages (likely JDs with no keywords)
  if (text.length > 300) return true;
  // Ignore very short messages or emoji-only
  if (text.length < 20 || /^[\p{Emoji}\s]+$/u.test(text)) return false;

  const hasJob = JOB_KEYWORDS.some(kw => lower.includes(kw));
  const hasResume = RESUME_KEYWORDS.some(kw => lower.includes(kw));
  return hasJob || hasResume;
}

export function getPreClassification(text: string): "job" | "resume" | "unknown" {
  const lower = text.toLowerCase();
  const jobScore = JOB_KEYWORDS.filter(kw => lower.includes(kw)).length;
  const resumeScore = RESUME_KEYWORDS.filter(kw => lower.includes(kw)).length;
  if (jobScore > resumeScore && jobScore > 0) return "job";
  if (resumeScore > 0) return "resume";
  return "unknown";
}
