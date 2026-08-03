/**
 * OpenAI Helper for serverless functions
 * 
 * Handles all OpenAI API calls from the backend.
 * CRITICAL: Never expose this to frontend React code.
 * 
 * Environment variable required: OPENAI_API_KEY
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

export async function callOpenAIJson({
  model = "gpt-4o-mini",
  systemPrompt,
  userPrompt,
  schema,
  temperature = 0.7,
  maxTokens = 2000,
} = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  // Add response format for structured output if schema is provided
  if (schema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        strict: true,
        schema,
      },
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  try {
    return JSON.parse(content);
  } catch {
    // If not JSON, return as string
    return content;
  }
}

export async function callOpenAIText({
  model = "gpt-4o-mini",
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxTokens = 2000,
} = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function callOpenAI({
  model = "gpt-4o-mini",
  systemPrompt,
  userPrompt,
  schema = null,
  temperature = 0.7,
  maxTokens = 2000,
} = {}) {
  return schema
    ? callOpenAIJson({ model, systemPrompt, userPrompt, schema, temperature, maxTokens })
    : callOpenAIText({ model, systemPrompt, userPrompt, temperature, maxTokens });
}

export function isOpenAIAvailable() {
  return !!OPENAI_API_KEY;
}