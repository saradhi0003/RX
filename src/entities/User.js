/**
 * User entity — wraps Supabase Auth + user_profiles.
 * Base44-compatible: .me(), .list(), .update()
 */
import { supabase } from "@/lib/supabase";
import { fetchOwnProfile } from "@/lib/appCache";

function normalize(row) {
  return { ...row, created_date: row.created_at };
}

export const User = {
  async me() {
    // Local session + the shared profile fetch (see appCache): a dozen
    // components call me() and each one used to cost two round trips.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    const { data: profile } = await fetchOwnProfile(user.id);
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
