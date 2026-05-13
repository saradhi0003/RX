/**
 * User entity — wraps Supabase Auth + user_profiles.
 * Base44-compatible: .me(), .list(), .update()
 */
import { supabase } from "@/lib/supabase";

function normalize(row) {
  return { ...row, created_date: row.created_at };
}

export const User = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    return normalize({ ...user, ...profile });
  },

  async list() {
    const { data, error } = await supabase.from("user_profiles").select("*");
    if (error) throw error;
    return (data || []).map(normalize);
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return normalize(data);
  },

  async logout() {
    await supabase.auth.signOut();
  },
};
