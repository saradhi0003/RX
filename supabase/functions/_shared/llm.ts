import OpenAI from "npm:openai@^4";
import Anthropic from "npm:@anthropic-ai/sdk@^0.39";
import { getSetting } from "./supabaseClient.ts";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Route to the correct LLM provider based on model name or explicit provider override */
export async function invokeLLM(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null
): Promise<string> {
  const resolvedModel = model || (await getSetting("llm_default_model")) || "gpt-4o-mini";
  const provider = detectProvider(resolvedModel);

  if (provider === "anthropic") {
    return callAnthropic(systemPrompt, userPrompt, resolvedModel);
  }
  if (provider === "ollama") {
    return callOllama(systemPrompt, userPrompt, resolvedModel);
  }
  return callOpenAI(systemPrompt, userPrompt, resolvedModel);
}

/** Like invokeLLM but instructs the model to respond with valid JSON and parses it */
export async function invokeLLMJson<T = unknown>(
  userPrompt: string,
  systemPrompt: string,
  model?: string | null
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no prose.`;
  const raw = await invokeLLM(userPrompt, jsonSystemPrompt, model);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function detectProvider(model: string): "openai" | "anthropic" | "ollama" {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("llama") || model.startsWith("mistral") || model.startsWith("phi")) return "ollama";
  return "openai";
}

async function callOpenAI(system: string, user: string, model: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") || (await getSetting("openai_key"));
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  });
  return res.choices[0]?.message?.content ?? "";
}

async function callAnthropic(system: string, user: string, model: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || (await getSetting("anthropic_key"));
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content[0];
  return block.type === "text" ? block.text : "";
}

async function callOllama(system: string, user: string, model: string): Promise<string> {
  const base = Deno.env.get("OLLAMA_BASE_URL") || "http://host.docker.internal:11434";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
  const json = await res.json();
  return json.message?.content ?? "";
}
