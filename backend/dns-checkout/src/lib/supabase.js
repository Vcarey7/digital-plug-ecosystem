import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client -- bypasses RLS by design. This process is the only
// thing that should ever hold this key; the frontend never sees it and
// never talks to Supabase directly (see migration notes).
export const supabase = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
  auth: { persistSession: false },
});
