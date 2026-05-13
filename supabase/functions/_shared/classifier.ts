import { invokeLLMJson } from "./llm.ts";

export type MessageClassification = "job" | "resume" | "reply" | "spam" | "unknown";

interface ClassifyResult {
  classification: MessageClassification;
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an AI assistant for a recruiting platform.
Classify the incoming message as one of:
- "job": Contains a job description, job opening, or hiring request
- "resume": Contains a resume, CV, or candidate profile
- "reply": A reply to a previous outreach (e.g., candidate responding to recruiter)
- "spam": Irrelevant, promotional, or junk message
- "unknown": Cannot determine with confidence

Return JSON: { "classification": "<type>", "confidence": <0.0-1.0>, "reasoning": "<short reason>" }`;

export async function classifyMessage(text: string): Promise<ClassifyResult> {
  try {
    const result = await invokeLLMJson<ClassifyResult>(
      `Classify this message:\n\n${text.slice(0, 3000)}`,
      SYSTEM_PROMPT,
      "gpt-4o-mini"
    );
    return result;
  } catch {
    return { classification: "unknown", confidence: 0, reasoning: "Classification failed" };
  }
}
