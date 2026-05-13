import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const isPlaceholder = (v) =>
  !v || v.includes("your-project-id") || v.includes("your-anon-key");

export const isSupabaseConfigured =
  !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "  Supabase not configured — edit .env.local:\n" +
    "  VITE_SUPABASE_URL=https://<id>.supabase.co\n" +
    "  VITE_SUPABASE_ANON_KEY=eyJ...\n" +
    "  Get these from: Supabase → Settings → API\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
}

export const supabase = createClient(
  isPlaceholder(supabaseUrl)     ? "https://placeholder.supabase.co" : supabaseUrl,
  isPlaceholder(supabaseAnonKey) ? "placeholder"                      : supabaseAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
