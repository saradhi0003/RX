# tests — how testing is wired

Two layers of tests. Full strategy per app-layer is in
[../TESTING.md](../TESTING.md).

## unit/ — Vitest (fast, mocked, offline)
- Config: [../vitest.config.js](../vitest.config.js) (jsdom, `@` alias, test env
  points Supabase at the mocked host).
- `setup.js` — jest-dom matchers + MSW lifecycle + `matchMedia` stub.
- `msw/` — mock network. `handlers.js` has default Supabase REST/Auth + `llmProxy`
  routes; override per-test with `server.use(...)` (auto-reset after each test).
- Group by layer: `lib/`, `data/`, `ui/`. Name `*.test.js(x)`.
- Run: `npm test` · `npm run test:watch` · `npm run test:coverage`.

### Writing a unit test
- Pure logic → import and assert (see `lib/utils.test.js`).
- Data/entity → `server.use(http.get(...))` then call the entity (see
  `data/entityFactory.test.js`).
- Component → `render()` + `screen` + `userEvent` (see `ui/button.test.jsx`);
  wrap router-dependent components in `MemoryRouter`, mock `useAuth`.
- **Never hit the real network or a real LLM** — mock via MSW / module mocks.

## smoke/ — Playwright (real browser)
- Config: [../playwright.config.js](../playwright.config.js) (serial, chromium,
  `baseURL` = `RX_TEST_URL` or `localhost:5175`, `webServer: undefined`).
- `../global-setup.js` signs in once as the **admin demo user** and saves the
  session to `.auth/admin.json` for reuse.
- Run: start a dev server, then `npm run test:smoke`. Needs a live/preview
  backend — blocked while the Supabase project is paused.

## Don't commit
`.auth/` (session state), `test-results/`, `playwright-report/`, `coverage/`
are gitignored artifacts.
