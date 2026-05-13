import { createClient } from "npm:@supabase/supabase-js@^2";

// Service-role client — bypasses RLS for server-side operations
export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/** Fetch a single app_settings value by key */
export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data ? (data.value as string) : null;
}

/** Fetch the (single) ai_recruiter_settings row */
export async function getAISettings() {
  const { data } = await supabase
    .from("ai_recruiter_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  return data;
}
