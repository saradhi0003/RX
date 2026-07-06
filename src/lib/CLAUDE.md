# src/lib — core utilities & singletons

The shared spine of the app. Most files here are **module-level singletons** —
import and use; don't re-instantiate.

## Files
- **supabase.js** — the one Supabase client. Exports `supabase` and
  `isSupabaseConfigured` (drives the "not connected" banner). Reads
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (build-time). Falls back to a
  placeholder client so the app still mounts without env.
- **entityFactory.js** — `createEntity(table)` → `{list, filter, get, create,
  update, delete}`. Base44-compat: `-field` DESC sort, `{$gt,$gte,$lt,$lte,$in,
  $like,$or}` filters, `created_at→created_date` alias. **No workspace/org
  filter — RLS decides visibility.** Errors `throw` — callers must handle.
- **llm.js** — provider-agnostic LLM. `invokeLLM/invokeLLMJson/invokeLLMStream`.
  Defaults to the `llmProxy` Edge Function (keys server-side). `VITE_LLM_DIRECT=
  true` enables dev-only direct calls. Fallback chain + streaming + `llm_usage`
  cost logging built in.
- **query-client.js** — the shared react-query `QueryClient`
  (`refetchOnWindowFocus:false`, `retry:1`).
- **appCache.js** — in-memory singleton cache (current user, roles, quick stats,
  dashboard). **userCache.js** / **dashboardCache.js** are thin re-exports of it.
- **app-params.js** — localStorage-backed prefs with snake_case keys; Node-safe.
- **utils.js** — `cn()` (clsx + tailwind-merge). Used everywhere for classnames.

## Rules
- Add a new table? Create `src/entities/X.js` (`createEntity("x")`) — don't call
  `supabase.from` in components.
- Need an LLM call? Go through `llm.js`; never import a provider SDK in the
  browser or add a `VITE_*` model key.
- Keep these files framework-light and side-effect-safe (they're imported early).

## Tests
Unit-tested with Vitest + MSW under `tests/unit/` (see
[../../TESTING.md](../../TESTING.md)). Mock Supabase/LLM HTTP with MSW; the test
env points the client at the mocked host.
