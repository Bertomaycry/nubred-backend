import { createClient } from "@supabase/supabase-js";

let supabaseClient = null;

export function resolveSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing in environment variables");
  }

  const key = serviceRoleKey || anonKey;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set in environment variables"
    );
  }

  return { supabaseUrl, key };
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const { supabaseUrl, key } = resolveSupabaseConfig();

  supabaseClient = createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}
