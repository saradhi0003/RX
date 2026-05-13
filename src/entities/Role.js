/**
 * Role entity — maps to Supabase user_profiles (role column).
 * Exposes a Base44-compatible API so pages that import Role keep working.
 */
import { supabase } from "@/lib/supabase";

function normalize(row) {
  return { ...row, created_date: row.created_at };
}

export const Role = {
  async list() {
    const { data, error } = await supabase.from("user_profiles").select("id, role, email, full_name");
    if (error) throw error;
    return (data || []).map(normalize);
  },
  async filter(conditions = {}) {
    let q = supabase.from("user_profiles").select("id, role, email, full_name");
    for (const [k, v] of Object.entries(conditions)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(normalize);
  },
  async update(id, fields) {
    const { data, error } = await supabase.from("user_profiles").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return normalize(data);
  },
};
