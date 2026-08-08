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
  Defaults to the `llmProxy` Edge Function (keys server-side). Set
  **`VITE_LLM_PROVIDER=lmstudio`** (or `ollama`) for dev-only direct local calls
  — there is no `VITE_LLM_DIRECT`, which this file claimed for a while.
  `invokeLLMJson` tolerates fenced/prose-wrapped JSON; `llm_usage` cost logging
  is built in.
- **llmRouter.js** — picks which local model serves each call when the provider
  is `lmstudio`. **With LM Link one endpoint covers every linked device**, so
  naming the model is how you name the device — there is no host-level routing
  to do. Ranks by parameter count parsed from the model id (`…-14b-…` → 14),
  banded into heavy/balanced/light tiers per task bucket, with model families
  only as a tie-break. Pass `task:` on an LLM call to steer it; free-form labels
  are mapped onto buckets by `routeFor()`. `describeRouting()` dumps what
  resolves where. Overrides: `VITE_LMSTUDIO_MODEL`, `VITE_LMSTUDIO_MODEL_MAP`.
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
