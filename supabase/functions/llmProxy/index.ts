// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
/**
 * llmProxy — Server-side LLM gateway.
 *
 * Keeps all LLM API keys out of the browser. Supports OpenAI, Anthropic,
 * DeepSeek, Alibaba/DashScope, Ollama, and any OpenAI-compatible endpoint.
 * The client calls this with the same shape it used to send to OpenAI directly,
 * and the function forwards using the existing _shared/llm.ts helpers.
 *
 * Deploy:
 *   supabase functions deploy llmProxy
 *   supabase secrets set OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... \
 *     DEEPSEEK_API_KEY=sk-... DASHSCOPE_API_KEY=sk-...
 *
 * Auth:
 *   Requires the caller to be authenticated (Authorization: Bearer <jwt>).
 *   Supabase's default function auth enforces this when verify_jwt is true
 *   (the default in config.toml).
 */
import { invokeLLM, invokeLLMJson, checkDailyCeiling } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireApprovedUser } from "../_shared/auth.ts";

interface ProxyRequest {
  prompt: string;
  system?: string;
  model?: string;
  response_format?: "json" | "text";
  task?: string;
}

Deno.serve(withErrorHandling(async (req: Request) => {
  if (req.method !== "POST") return errResponse("Method not allowed", 405);

  // Approval gate — the service role bypasses RLS, so re-check here.
  const gate = await requireApprovedUser(req);
  if (gate.response) return gate.response;

  const body = (await req.json().catch(() => null)) as ProxyRequest | null;
  if (!body?.prompt) return errResponse("Missing 'prompt' in request body", 400);

  // Enforce the daily cost ceiling before spending more (429 when exceeded).
  const ceiling = await checkDailyCeiling();
  if (!ceiling.ok) {
    return errResponse(
      `LLM daily cost ceiling reached ($${ceiling.spent.toFixed(2)} of $${ceiling.ceiling}). ` +
      "Raise LLM_DAILY_COST_CEILING_USD or wait until tomorrow (UTC).",
      429,
    );
  }

  const t0 = Date.now();
  let text: string;
  let parsed: unknown = undefined;
  const opts = {
    task: body.task ?? "unknown",
    userEmail: gate.user?.email ?? undefined,
    // Attribute spend to the caller's own workspace rather than letting it
    // fall back to the default one — llm_usage.workspace_id is NOT NULL and
    // the service-role client can't resolve it from auth.uid().
    workspaceId: gate.profile?.workspace_id ?? undefined,
  };

  if (body.response_format === "json") {
    parsed = await invokeLLMJson(body.prompt, body.system ?? "", body.model, opts);
    text = JSON.stringify(parsed);
  } else {
    text = await invokeLLM(body.prompt, body.system ?? "", body.model, opts);
  }

  return okResponse({
    text,
    parsed,
    latency_ms: Date.now() - t0,
    task: body.task ?? "unknown",
    usage_logged: true,
  });
}));
