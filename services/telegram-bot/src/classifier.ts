/**
 * Keyword-based pre-filter for chat messages.
 * Returns true if the message is likely a job posting or resume.
 */

const JOB_KEYWORDS = [
  "requirement", "requirements",
  "jd", "job description",
  "looking for", "urgent need", "urgently need",
  "c2c", "corp to corp", "w2", "w-2", "1099",
  "remote", "onsite", "on-site", "hybrid",
  "hiring", "position", "role",
  "consultant needed", "consultants needed",
  "opening", "openings",
  "skills required", "skill set",
  "years of experience",
  "must have",
  "immediate", "asap",
  "/hr", "per hour", "per year",
];

const RESUME_KEYWORDS = [
  "resume", "cv", "curriculum vitae",
  "looking for job", "looking for opportunity",
  "available for", "open to work",
  "years experience",
  "attached my resume",
  "please review",
];

export function isLikelyJobOrResume(text: string): boolean {
  const lower = text.toLowerCase();
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
