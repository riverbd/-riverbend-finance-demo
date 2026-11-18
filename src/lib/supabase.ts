import { createClient } from "@supabase/supabase-js";

/**
 * Reusable Supabase client for Riverbend Finance.
 *
 * Credentials come from Vite environment variables so they are never
 * hard-coded in the bundle source:
 *
 *   VITE_SUPABASE_URL        e.g. https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY   the publishable / anon key
 *
 * Set them in `.env` locally (git-ignored) — see `.env.example`.
 *
 * NOTE: both values ship to the browser by design. Only ever use the
 * publishable (anon) key here, never a service_role / secret key, and
 * rely on Row Level Security in Supabase for real protection.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True when both env vars are present, so features can check before using Supabase. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Fail loudly with an actionable message rather than a confusing
  // "fetch failed" later on. Copy .env.example to .env and fill it in.
  throw new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY in your .env file (see .env.example)."
  );
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
