// Default MSW request handlers. Individual tests can override a route with
// `server.use(...)` for a single test (reset automatically after each test).
import { http, HttpResponse } from "msw";

const SUPABASE = "https://bwjfglerixssibenkjse.supabase.co";

export const handlers = [
  // ── Supabase REST: generic table select returns an empty list by default ──
  http.get(`${SUPABASE}/rest/v1/:table`, () => HttpResponse.json([])),
  http.post(`${SUPABASE}/rest/v1/:table`, async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return HttpResponse.json([{ id: "test-id", ...body }], { status: 201 });
  }),

  // ── Supabase Auth ──
  http.post(`${SUPABASE}/auth/v1/token`, () =>
    HttpResponse.json({
      access_token: "test-token",
      token_type: "bearer",
      user: { id: "test-user", email: "test@example.com" },
    }),
  ),
  http.get(`${SUPABASE}/auth/v1/user`, () =>
    HttpResponse.json({ id: "test-user", email: "test@example.com" }),
  ),

  // ── Supabase Edge Function: llmProxy (LLM calls route through here) ──
  http.post(`${SUPABASE}/functions/v1/llmProxy`, () =>
    HttpResponse.json({ text: "mock LLM response", usage: { total_tokens: 42 } }),
  ),
];
