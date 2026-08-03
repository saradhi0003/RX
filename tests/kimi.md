# tests/kimi.md — Testing guidance

## Scope

`tests/` contains Vitest unit/integration tests and Playwright smoke/e2e tests.

## Commands

```bash
npm test              # Vitest
npm run test:smoke    # Playwright (needs dev server running)
npm run test:all      # both
```

## Structure

- `tests/unit/` — Vitest tests.
- `tests/smoke/` — Playwright specs.
- `tests/global-setup.js` — shared Playwright setup.

## Conventions

- Mock Supabase and LLM calls in unit tests; don't hit live services.
- Use MSW for HTTP mocks where applicable.
- Keep e2e tests focused on critical user paths (login, candidate CRUD, approval flow).
- DB-dependent tests may fail if the Supabase project is paused (noted in `CLAUDE.md`).

## Token-saving tips

- Run `npm test` before `npm run test:smoke` for faster feedback.
- If DB is paused, rely on unit tests + typecheck + build for validation.
- For test fixtures, reuse `evals/fixtures.json` patterns where applicable.

## Common tasks (cookbook)

### Add a unit test
1. Create `tests/unit/myFeature.test.js`.
2. Import the function under test.
3. Mock external dependencies (Supabase, LLM, fetch).

### Add an e2e test
1. Create `tests/smoke/myFlow.spec.js`.
2. Use existing login helper if available.
3. Run against local dev server (`npm run dev`).
