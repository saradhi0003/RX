/**
 * Timesheet field helpers.
 *
 * The `timesheets` table's real columns are `user_email`, `work_date` and
 * `hours_worked` — NOT `user_id`, `date`, `hours`. Several call sites used the
 * latter set, which PostgREST rejects outright ("Could not find the 'date'
 * column of 'timesheets' in the schema cache"), so logging time failed every
 * time. `week_start` and `week_end` are additionally NOT NULL, so even a
 * single-day entry has to declare the week it belongs to.
 *
 * Everything that writes a timesheet should build its payload through
 * `timesheetPayload()` so the shape lives in exactly one place.
 */

/** Monday→Sunday bounds for the week containing `isoDate` (YYYY-MM-DD). */
export function weekBounds(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x) => x.toISOString().slice(0, 10);
  return { week_start: iso(start), week_end: iso(end) };
}

/**
 * Build a valid `timesheets` insert payload.
 *
 * @param {{ email: string, date: string, hours: number|string,
 *           notes?: string, status?: string }} input
 */
export function timesheetPayload({ email, date, hours, notes = "", status = "submitted" }) {
  const workDate = date || new Date().toISOString().slice(0, 10);
  return {
    user_email: email || "",
    work_date: workDate,
    hours_worked: Number(hours) || 0,
    ...weekBounds(workDate),
    status,
    notes,
  };
}
