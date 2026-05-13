import { corsHeaders } from "./supabaseClient.ts";

export function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errResponse(message: string, status = 500): Response {
  console.error(`[EdgeFn] ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function corsOk(): Response {
  return new Response("ok", { headers: corsHeaders });
}

/** Wraps a handler so every uncaught error returns a 500 JSON response */
export function withErrorHandling(
  fn: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return corsOk();
    try {
      return await fn(req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errResponse(msg, 500);
    }
  };
}
