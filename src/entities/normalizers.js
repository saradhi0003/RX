/**
 * Write normalisers for `createEntity(..., { beforeWrite })`.
 *
 * WHY THIS EXISTS
 * `candidates`, `consultants` and `recruiters` all carry `full_name NOT NULL`
 * with no default and no database trigger to populate it — but every form in
 * the app collects `first_name` and `last_name` instead. So each insert was
 * rejected by Postgres with a not-null violation, which is why "save" appeared
 * to do nothing and the dialog never closed.
 *
 * Deriving it here rather than in the form means CSV import, paste-to-add, the
 * public careers form, AI quick actions and the bulk resume upload are all
 * fixed by the same change.
 */

/** Trim and collapse whitespace; "" becomes undefined so we never write blanks. */
const clean = (v) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v;
  return s || undefined;
};

/**
 * `expenses` carries BOTH `title` (NOT NULL) and `name` (nullable) — a leftover
 * from an earlier schema. ExpenseForm only ever writes `name`, so `title` came
 * through NULL and Postgres rejected every expense the same way it rejected
 * candidates. Mirror the two so either column can be read.
 *
 * @param {object} fields
 * @returns {object}
 */
export function withExpenseTitle(fields) {
  const out = { ...fields };
  const title = clean(out.title);
  const name = clean(out.name);

  if (!title && name) out.title = name;
  else if (title && !name) out.name = title;

  return out;
}

/**
 * Keep `full_name` consistent with `first_name` / `last_name`.
 *
 * On update the payload is often partial (just a status change), so this only
 * touches `full_name` when the write actually carries a name — otherwise a
 * routine edit would blank a column the database refuses to have empty.
 *
 * @param {object} fields
 * @returns {object}
 */
export function withFullName(fields) {
  const out = { ...fields };
  const first = clean(out.first_name);
  const last = clean(out.last_name);
  const explicit = clean(out.full_name);

  if (explicit) {
    out.full_name = explicit;
    // Backfill the split fields when only a whole name was supplied (the AI
    // parsers and some imports do this), so list views still render.
    if (!first && !last) {
      const parts = explicit.split(" ");
      out.first_name = parts[0];
      if (parts.length > 1) out.last_name = parts.slice(1).join(" ");
    }
    return out;
  }

  const derived = [first, last].filter(Boolean).join(" ");
  if (derived) out.full_name = derived;
  else delete out.full_name;   // partial update with no name — leave it alone

  return out;
}
