import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.warn(
    "Supabase env vars are missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Auth and data storage are disabled until they're set."
  );
}

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
