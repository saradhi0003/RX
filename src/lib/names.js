/**
 * Display name for a person-shaped record.
 *
 * Call sites used to interpolate `${first_name} ${last_name}` directly, which
 * renders the string "null null" whenever a row carries only `full_name` — and
 * half the candidate table was in exactly that state, so Applications showed
 * "Unknown" or a pair of nulls. The stored data has been backfilled, but AI
 * parsers and CSV imports can reintroduce whole-name-only rows at any time, so
 * the read side should not depend on the split having happened.
 *
 * @param {{first_name?: string, last_name?: string, full_name?: string, email?: string}|null|undefined} person
 * @param {string} [fallback]
 * @returns {string}
 */
export function personName(person, fallback = "Unknown") {
  if (!person) return fallback;

  const split = [person.first_name, person.last_name]
    .filter((p) => typeof p === "string" && p.trim())
    .join(" ")
    .trim();
  if (split) return split;

  const full = typeof person.full_name === "string" ? person.full_name.trim() : "";
  if (full) return full;

  // An email is a poorer label than a name but far better than "Unknown" —
  // it still identifies the row for a recruiter scanning a list.
  const email = typeof person.email === "string" ? person.email.trim() : "";
  if (email) return email;

  return fallback;
}
