import { supabase } from "@/lib/supabase";

const SETTING_KEY = "dashboard_config";

function toRecord(row) {
  if (!row) return null;
  const v = row.value || {};
  return { id: row.id, ...v, created_date: row.created_at, updated_date: row.updated_at };
}

export const DashboardConfig = {
  async filter() {
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", SETTING_KEY)
      .limit(1);
    return (data || []).map(toRecord);
  },
  async create(fields) {
    const { widgets, ...rest } = fields;
    const { data, error } = await supabase
      .from("app_settings")
      .insert({ key: SETTING_KEY, value: { widgets, ...rest } })
      .select()
      .single();
    if (error) throw error;
    return toRecord(data);
  },
  async update(id, fields) {
    const { widgets, ...rest } = fields;
    const { data, error } = await supabase
      .from("app_settings")
      .update({ value: { widgets, ...rest } })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toRecord(data);
  },
};
