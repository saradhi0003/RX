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

/**
 * @param {string} tableName
 * @param {{beforeWrite?: (fields: object, op: "create"|"update") => object,
 *          afterRead?: (row: object) => object}} [opts]
 *   `beforeWrite` normalises a payload just before it hits Postgres. It exists
 *   because several tables carry NOT NULL columns the UI never collects
 *   directly (`candidates.full_name` is derived from first+last), and patching
 *   each form would leave CSV import, paste-to-add, the careers form and the AI
 *   quick actions still broken. One hook covers every write path.
 *
 *   `afterRead` is its mirror, for columns whose stored vocabulary differs from
 *   the one the UI speaks (`tasks.status`). Both are needed or a translated
 *   write becomes invisible to the filter that reads it back.
 */
export function createEntity(tableName, { beforeWrite = (f) => f, afterRead = (r) => r } = {}) {
  const shape = (row) => (row ? afterRead(normalize(row)) : row);
  return {
    /** list(sortField?, limit?) */
    async list(sortField = "-created_at", limit = 200) {
      const { column, ascending } = parseSortField(sortField);
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order(column, { ascending })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(shape);
    },

    /** filter(conditions, sortField?, limit?) */
    async filter(conditions = {}, sortField = "-created_at", limit = 200) {
      const { column, ascending } = parseSortField(sortField);
      let query = supabase.from(tableName).select("*");
      query = applyFilters(query, conditions);
      const { data, error } = await query
        .order(column, { ascending })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(shape);
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
      let query = supabase.from(tableName).select("*", { count: "exact", head: true });
      query = applyFilters(query, conditions);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },

    /** get(id) */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
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
        .select()
        .single();
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
        .select()
        .single();
      if (error) throw error;
      return shape(data);
    },

    /** delete(id) */
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
      return { id };
    },
  };
}
