// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
/**
 * llmProxy — Server-side LLM gateway.
 *
 * Keeps OPENAI_API_KEY / ANTHROPIC_API_KEY out of the browser. The client
 * calls this with the same shape it used to send to OpenAI directly, and the
 * function forwards using the existing _shared/llm.ts helpers.
 *
 * Deploy:
 *   supabase functions deploy llmProxy
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * Auth:
 *   Requires the caller to be authenticated (Authorization: Bearer <jwt>).
 *   Supabase's default function auth enforces this when verify_jwt is true
 *   (the default in config.toml).
 */
import { invokeLLM, invokeLLMJson } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

interface ProxyRequest {
  prompt: string;
  system?: string;
  model?: string;
  response_format?: "json" | "text";
  task?: string;
}

Deno.serve(withErrorHandling(async (req: Request) => {
  if (req.method !== "POST") return errResponse("Method not allowed", 405);

  const body = (await req.json().catch(() => null)) as ProxyRequest | null;
  if (!body?.prompt) return errResponse("Missing 'prompt' in request body", 400);

  const t0 = Date.now();
  let text: string;
  let parsed: unknown = undefined;

  if (body.response_format === "json") {
    parsed = await invokeLLMJson(body.prompt, body.system ?? "", body.model);
    text = JSON.stringify(parsed);
  } else {
    text = await invokeLLM(body.prompt, body.system ?? "", body.model);
  }

  return okResponse({
    text,
    parsed,
    latency_ms: Date.now() - t0,
    task: body.task ?? "unknown",
  });
}));
