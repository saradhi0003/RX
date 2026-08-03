import { AsyncLocalStorage } from "node:async_hooks";
import { corsHeadersFor } from "./cors.ts";

const corsStore = new AsyncLocalStorage<string | null>();

function currentOrigin(explicit?: string | null): string | null {
  return explicit ?? corsStore.getStore() ?? null;
}

export function okResponse(body: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(currentOrigin(origin)), "Content-Type": "application/json" },
  });
}

export function errResponse(message: string, status = 500, origin?: string | null): Response {
  console.error(`[EdgeFn] ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeadersFor(currentOrigin(origin)), "Content-Type": "application/json" },
  });
}

export function corsOk(origin?: string | null): Response {
  return new Response("ok", { headers: corsHeadersFor(currentOrigin(origin)) });
}

/** Wraps a handler so every uncaught error returns a 500 JSON response.
 *  Tracks the request origin via AsyncLocalStorage so that okResponse/
 *  errResponse called anywhere inside the handler get the right CORS headers.
 */
export function withErrorHandling(
  fn: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get("origin");
    return corsStore.run(origin, async () => {
      if (req.method === "OPTIONS") return corsOk();
      try {
        return await fn(req);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return errResponse(msg, 500);
      }
    });
  };
}
