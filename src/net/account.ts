import { getSupabase } from "./supabase-client";

/**
 * What an account asks of the backend. Signing in is Supabase Auth with
 * Google; the profile goes through the functions of `supabase/schema.sql`,
 * which take the caller from the session, never from the request.
 */

export interface Profile {
  displayName: string;
}

/** Leaves for Google and comes back to this page, where the auth client finishes the sign-in. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
      // Otherwise Google signs straight back into whichever account the browser uses.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(`Connexion à Google impossible : ${error.message}`);
}

/** Signs this browser out; the next room is joined as a guest. */
export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut({ scope: "local" });
  if (error) throw new Error(`Déconnexion impossible : ${error.message}`);
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase().rpc("get_my_profile");
  if (error) throw new Error(error.message);
  const raw = data as { display_name?: unknown } | null;
  return raw && typeof raw.display_name === "string" ? { displayName: raw.display_name } : null;
}

/** The database words its own refusals, so its message is passed on as it is. */
export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await getSupabase().rpc("save_profile", { p_display_name: profile.displayName });
  if (error) throw new Error(error.message);
}
