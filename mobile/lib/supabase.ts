import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // EXPO_PUBLIC_* are inlined at BUILD time — an APK built without them is
  // permanently broken and no OTA update can repair it. Say so loudly.
  console.error(
    'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example) and rebuild — these ' +
      'are baked in at build time, not read at runtime.'
  );
}

/**
 * The one Supabase client for the mobile app. Same project and same anon key as
 * the web app; AsyncStorage replaces localStorage and detectSessionInUrl is off
 * because there is no URL bar to read a magic-link fragment from.
 *
 * The anon key is public by design. What actually protects candidate data is
 * RLS + auth_is_approved() (migration 020) — an unapproved user holding a valid
 * JWT reads zero rows through this client.
 */
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
