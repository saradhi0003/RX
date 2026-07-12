# src/pages — route-level screens

One file = one route. ~52 pages. Registered (name → lazy import) in
[../pages.config.js](../pages.config.js); routes generated in
[../App.jsx](../App.jsx).

## Adding a page
1. Create `src/pages/MyThing.jsx` (default-export a component).
2. Add `"MyThing": lazy(() => import('./pages/MyThing'))` to `pages.config.js`.
3. It auto-renders inside `<Layout>` behind `PrivateRoute` at `/MyThing`.
   Auth pages (`Login`, `Register`, `Onboarding`) are the exception — wired
   explicitly in `App.jsx` outside the Layout.

## Conventions
- **Data:** fetch via entities (`@/entities/*`) + react-query — never
  `supabase.from` directly. Handle the `throw` from entity calls: use
  `useEntityList` (`@/hooks/useEntityList`) + `EmptyState`
  (`@/components/common/EmptyState`) — never render blank rows on error.
- **Navigation:** `createPageUrl` from `@/utils` + react-router. Deep links carry
  state in the query string (enterprise pattern — see ARCHITECTURE.md §9.5).
- **Layout:** don't re-implement the shell; the page renders inside `<Layout>`.
- **Permissions:** gate actions with `PermissionGate` /
  `@/components/common/PermissionsContext`.
- **List tables:** a page with a data grid should get sortable + resizable columns
  from the shared hooks/components, not a bespoke implementation — see
  [../components/CLAUDE.md](../components/CLAUDE.md) → "Shared list tables"
  (`@/hooks/useTableSort`, `@/hooks/useColumnResize`, `common/DataTable`).
- Keep pages thin — push logic into `src/components/<domain>/` and `src/lib`.

## Auth surface
`Login.jsx` (password + magic-link OTP + demo buttons), `Register.jsx`
(multi-step, creates the workspace at signup on the multi-tenancy branch),
`AuthContext` in `@/lib`. **MFA (TOTP) is live** (merged + e2e-proven 2026-07-06);
email verification is on and new signups need admin approval — see
[../../AUTH_SETUP.md](../../AUTH_SETUP.md) and root [CLAUDE.md](../../CLAUDE.md).

## Tests
RTL render tests go in `tests/unit/ui/`; wrap pages in `MemoryRouter` and mock
`useAuth`. Full navigation flows: Playwright `tests/smoke/pages.spec.js`.
