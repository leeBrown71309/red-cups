import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthStorage } from "./auth-storage";

/**
 * The Supabase connection, created on first use of the online mode. A build
 * without the two environment variables is a local-only game: the lobby
 * checks `onlineAvailable` before offering to play online.
 *
 * The publishable key ships with the site on purpose. It grants nothing on
 * its own: tables are closed, and every function checks the caller's seat.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const onlineAvailable = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Le mode en ligne n’est pas configuré.");
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: createAuthStorage(window.sessionStorage, window.localStorage),
      // Google hands back a code on the redirect, exchanged here for the session.
      flowType: "pkce",
      detectSessionInUrl: true,
    },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

/**
 * Gives this device an identity, signing in as a guest when nobody is signed
 * in. The database needs one to tell players apart and to refuse a move made
 * from someone else's seat.
 */
export async function ensureSession(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (!error && signed.user) return signed.user.id;
  throw new Error(
    "Connexion impossible. Active « Anonymous Sign-Ins » dans le projet Supabase (Authentication → Providers).",
  );
}
