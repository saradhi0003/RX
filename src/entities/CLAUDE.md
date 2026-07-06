# src/entities — the data model surface

Each file is a one-line wrapper over the entity factory:

```js
import { createEntity } from "@/lib/entityFactory";
export const Candidate = createEntity("candidates");
```

That yields `{ list, filter, get, create, update, delete }` — the only sanctioned
way to touch a table from the frontend. `all.js` re-exports them;
`User.js` is special (auth-bound). `@/api/entities` is a back-compat barrel.

## Adding an entity
1. Ensure the table + **RLS policy** exist (a migration in `supabase/migrations/`).
2. `export const Thing = createEntity("things");`
3. Add it to `all.js`.
4. Use `Thing.list()` / `Thing.filter({...})` in pages/components.

## Remember
- **Visibility is RLS**, not these wrappers — they add no org/workspace filter.
  On the multi-tenancy branch, a DB trigger stamps `workspace_id` on insert, so
  `create()` still needs no change.
- Filters use Base44 syntax: `filter({ status: "active", years: { $gte: 3 } })`,
  sort with `"-created_at"`. Rows come back with a `created_date` alias.
- Calls `throw` on error — handle in the caller.

Tested via `tests/unit/data/` with MSW (see [../../TESTING.md](../../TESTING.md)).
