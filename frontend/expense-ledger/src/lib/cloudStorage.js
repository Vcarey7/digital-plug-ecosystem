import { supabase } from "./supabaseClient.js";

/**
 * Reads a JSON value previously saved under `key` for the signed-in user.
 * Returns null if nothing is stored yet (mirrors localStorage.getItem semantics).
 */
export async function cloudGet(key) {
  const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

/**
 * Upserts a JSON value under `key` for the signed-in user.
 */
export async function cloudSet(key, value) {
  const { error } = await supabase.from("app_data").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
  if (error) throw error;
}
