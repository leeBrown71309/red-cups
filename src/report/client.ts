import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The connection of the reporting page. It signs the admin in on its own
 * session, kept in this tab under its own key: whatever Google or guest
 * session the game holds in the same browser stays untouched.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const reportsAvailable = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

export function getReportClient(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Le signalement n’est pas connecté à une base de données.");
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "red-cups-admin-auth",
      storage: window.sessionStorage,
    },
  });
  return client;
}
