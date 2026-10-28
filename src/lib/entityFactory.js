/**
 * entityFactory(tableName) → { list, filter, create, update, delete, get }
 *
 * Drop-in replacement for Base44 entity SDK methods.
 * All methods return plain objects. Arrays get a `created_date` alias so
 * existing JSX that reads `.created_date` keeps working.
 */
import { supabase } from "./supabase";

// Base44 uses "-field" for DESC sort; convert to Supabase { column, ascending }
function parseSortField(sortStr) {
  if (!sortStr) return { column: "created_at", ascending: false };
  const desc = sortStr.startsWith("-");
  const column = desc ? sortStr.slice(1) : sortStr;
  // Map Base44 virtual field names to real DB columns
  const colMap = {
    created_date: "created_at",
    updated_date: "updated_at",
    submitted_date: "submitted_at",
  };
  return { column: colMap[column] || column, ascending: !desc };
}

// Add Base44-style virtual aliases to every row
function normalize(row) {
  if (!row) return row;
  const out = { ...row, created_date: row.created_at };
  if (row.submitted_at !== undefined) out.submitted_date = row.submitted_at;
  return out;
}

// Build a Supabase query from a Base44-style filter object
// { field: value } → .eq(field, value)
// { field: { $gt: v } } → .gt(field, v)
// { $or: [...] } → .or(...)
function applyFilters(query, filters = {}) {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "$or") {
      const parts = value
        .map((f) => {
          const [[k, v]] = Object.entries(f);
          return `${k}.eq.${v}`;
        })
        .join(",");
      query = query.or(parts);
    } else if (value !== null && typeof value === "object") {
      if ("$gt" in value) query = query.gt(key, value.$gt);
      if ("$gte" in value) query = query.gte(key, value.$gte);
      if ("$lt" in value) query = query.lt(key, value.$lt);
      if ("$lte" in value) query = query.lte(key, value.$lte);
      if ("$in" in value) query = query.in(key, value.$in);
      if ("$like" in value) query = query.ilike(key, value.$like);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

// ── Read sharing ────────────────────────────────────────────────────────────
// Pages, Layout and widgets ask for the same rows at the same moment (opening
// Candidates fired the identical 200-row query three times within 30ms), and
// every navigation threw away what the last visit had already loaded. Two
// small mechanisms, neither of which changes what a caller gets back:
//   - an identical read already in flight is shared, not repeated;
//   - the last result of each read is kept as a snapshot, so a page being
//     revisited can paint it immediately (`peekList` / `peekFilter`) while its
//     normal load fetches fresh rows. Reads themselves always hit the network.
// Any write through this factory drops that table's snapshots, and bumps a
// generation so a read that started before the write can't restore them.
/** @type {Map<string, Promise<any[]>>} */
const inflightReads = new Map();
/** @type {Map<string, any[]>} */
const readSnapshots = new Map();
/** @type {Map<string, number>} */
const tableGeneration = new Map();

/**
 * @param {string} table
 * @param {string} key
 * @param {() => Promise<any[]>} run
 */
function sharedRead(table, key, run) {
  const pending = inflightReads.get(key);
  if (pending) return pending.then((rows) => rows.slice());
  const generation = tableGeneration.get(table) || 0;
  const p = run().then(
    (rows) => {
      inflightReads.delete(key);
      if ((tableGeneration.get(table) || 0) === generation) readSnapshots.set(key, rows);
      return rows;
    },
    (err) => {
      inflightReads.delete(key);
      throw err;
    },
  );
  inflightReads.set(key, p);
  // Each caller gets its own array: pages sort and splice what they receive.
  return p.then((rows) => rows.slice());
}

/** @param {string} table */
function dropSnapshots(table) {
  tableGeneration.set(table, (tableGeneration.get(table) || 0) + 1);
  for (const key of readSnapshots.keys()) if (key.startsWith(`${table}|`)) readSnapshots.delete(key);
}

/** Forget every kept read — call on sign-out so the next user starts clean. */
export function clearEntitySnapshots() {
  readSnapshots.clear();
  inflightReads.clear();
}

/**
 * @param {string} tableName
 * @param {{beforeWrite?: (fields: object, op: "create"|"update") => object,
 *          afterRead?: (row: object) => object,
 *          columns?: string}} [opts]
 *   `beforeWrite` normalises a payload just before it hits Postgres. It exists
 *   because several tables carry NOT NULL columns the UI never collects
 *   directly (`candidates.full_name` is derived from first+last), and patching
 *   each form would leave CSV import, paste-to-add, the careers form and the AI
 *   quick actions still broken. One hook covers every write path.
 *
 *   `afterRead` is its mirror, for columns whose stored vocabulary differs from
 *   the one the UI speaks (`tasks.status`). Both are needed or a translated
 *   write becomes invisible to the filter that reads it back.
 *
 *   `columns` is the select list, defaulting to `*`. Set it for tables that
 *   hold secrets in columns the browser role must never read: a table with
 *   column-level grants (`REVOKE SELECT … ; GRANT SELECT (a, b) …`) rejects
 *   `SELECT *` outright with "permission denied", so the default would make
 *   every read fail rather than merely hide the column. `email_accounts`
 *   (OAuth tokens, migration 032) is the case this exists for.
 */
export function createEntity(
  tableName,
  { beforeWrite = (f) => f, afterRead = (r) => r, columns = "*" } = {},
) {
  const shape = (row) => (row ? afterRead(normalize(row)) : row);
  const listKey = (sortField, limit) => `${tableName}|${columns}|list|${sortField}|${limit}`;
  const filterKey = (conditions, sortField, limit) =>
    `${tableName}|${columns}|filter|${JSON.stringify(conditions)}|${sortField}|${limit}`;
  const peek = (key) => {
    const rows = readSnapshots.get(key);
    return rows ? rows.slice() : undefined;
  };
  return {
    /** list(sortField?, limit?) */
    list(sortField = "-created_at", limit = 200) {
      return sharedRead(tableName, listKey(sortField, limit), async () => {
        const { column, ascending } = parseSortField(sortField);
        const { data, error } = await supabase
          .from(tableName)
          .select(columns)
          .order(column, { ascending })
          .limit(limit);
        if (error) throw error;
        return (data || []).map(shape);
      });
    },

    /** filter(conditions, sortField?, limit?) */
    filter(conditions = {}, sortField = "-created_at", limit = 200) {
      return sharedRead(tableName, filterKey(conditions, sortField, limit), async () => {
        const { column, ascending } = parseSortField(sortField);
        let query = supabase.from(tableName).select(columns);
        query = applyFilters(query, conditions);
        const { data, error } = await query
          .order(column, { ascending })
          .limit(limit);
        if (error) throw error;
        return (data || []).map(shape);
      });
    },

    /**
     * The rows the last identical list()/filter() returned, or undefined.
     * Synchronous and network-free: for painting a revisited page at once,
     * never as a substitute for the read that follows.
     */
    peekList(sortField = "-created_at", limit = 200) {
      return peek(listKey(sortField, limit));
    },
    peekFilter(conditions = {}, sortField = "-created_at", limit = 200) {
      return peek(filterKey(conditions, sortField, limit));
    },

    /**
     * count(conditions?) → exact number of matching rows.
     *
     * Metrics MUST use this, never `(await list()).length`. Every list call
     * here is capped (default 200), so counting the returned array silently
     * reports the cap instead of the truth once a table outgrows it — the
     * Dashboard was reporting 50 companies against a real 2360, and a pipeline
     * of 50 against a real 98, with no indication anything was truncated.
     *
     * `head: true` means Postgres returns the count only and transfers no
     * rows, so this is cheaper than the list it replaces. RLS still applies,
     * so a user only ever counts what they may see.
     */
    async count(conditions = {}) {
      let query = supabase.from(tableName).select(columns, { count: "exact", head: true });
      query = applyFilters(query, conditions);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },

    /** get(id) */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .eq("id", id)
        .single();
      if (error) throw error;
      return shape(data);
    },

    /** create(fields) */
    async create(fields) {
      const { created_date: _drop, ...clean } = fields;
      const { data, error } = await supabase
        .from(tableName)
        .insert(beforeWrite(clean, "create"))
        .select(columns)
        .single();
      dropSnapshots(tableName);
      if (error) throw error;
      return shape(data);
    },

    /** update(id, fields) */
    async update(id, fields) {
      const { created_date: _drop, id: _id, ...clean } = fields;
      const { data, error } = await supabase
        .from(tableName)
        .update(beforeWrite(clean, "update"))
        .eq("id", id)
        .select(columns)
        .single();
      dropSnapshots(tableName);
      if (error) throw error;
      return shape(data);
    },

    /** delete(id) */
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      dropSnapshots(tableName);
      if (error) throw error;
      return { id };
    },
  };
}
