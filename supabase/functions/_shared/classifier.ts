import { invokeLLMJson } from "./llm.ts";

export type MessageClassification = "job" | "resume" | "reply" | "spam" | "unknown";

interface ClassifyResult {
  classification: MessageClassification;
  confidence: number;
  reasoning: string;
  /**
   * True when the classifier never ran (LLM/tunnel down, bad JSON) as opposed
   * to running and genuinely landing on "unknown". Callers must tell these
   * apart: a real "unknown" is a decision and can be filed away, but a failure
   * filed away the same way discards the message on an outage.
   */
  failed?: boolean;
}

const SYSTEM_PROMPT = `You are an AI assistant for a recruiting platform.
Classify the incoming message as one of:
- "job": Contains a job description, job opening, or hiring request
- "resume": Contains a resume, CV, or candidate profile
- "reply": A reply to a previous outreach (e.g., candidate responding to recruiter)
- "spam": Irrelevant, promotional, or junk message
- "unknown": Cannot determine with confidence

Return JSON: { "classification": "<type>", "confidence": <0.0-1.0>, "reasoning": "<short reason>" }`;

export async function classifyMessage(text: string, model?: string | null): Promise<ClassifyResult> {
  try {
    // Model comes from the caller (ai_recruiter_settings.parsing_model —
    // local-first). Passing null lets invokeLLM resolve its configured
    // default; never hardcode a cloud model here.
    const result = await invokeLLMJson<ClassifyResult>(
      `Classify this message:\n\n${text.slice(0, 3000)}`,
      SYSTEM_PROMPT,
      model || null
    );
    return result;
  } catch (e) {
    return {
      classification: "unknown",
      confidence: 0,
      reasoning: `Classification failed: ${e instanceof Error ? e.message : String(e)}`,
      failed: true,
    };
  }
}
