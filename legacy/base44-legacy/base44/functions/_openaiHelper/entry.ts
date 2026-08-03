// OpenAI Helper for Base44 serverless functions
// CRITICAL: Never expose OPENAI_API_KEY to frontend

export async function callOpenAI(params) {
  const {
    model = "gpt-4o-mini",
    systemPrompt = "",
    userPrompt = "",
    schema = null,
    temperature = 0.7,
    maxTokens = 2000,
  } = params || {};

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt || "You are a helpful AI recruiter assistant." },
      { role: "user", content: userPrompt },
    ],
  };

  if (schema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        strict: false,
        schema,
      },
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `OpenAI error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("Empty response from OpenAI");

    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  } catch (error) {
    throw new Error(`OpenAI integration failed: ${error.message}`);
  }
}