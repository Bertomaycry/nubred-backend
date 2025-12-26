import { createClient } from "@supabase/supabase-js";

// Trim values to handle whitespace/quotes in .env files
const supabaseUrl = process.env.SUPABASE_URL?.trim();

// Check all possible Supabase key variable names (in order of preference)
const supabaseServiceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("SUPABASE_URL");
  if (!supabaseServiceRoleKey) {
    missingVars.push(
      "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_ANON_KEY"
    );
  }
  throw new Error(
    `Missing required Supabase configuration: ${missingVars.join(" and ")} must be set in environment variables`
  );
}

// Backend uses SERVICE_ROLE_KEY for admin operations (token verification)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
