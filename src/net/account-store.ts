import { create } from "zustand";
import { fetchMyProfile, saveProfile, signInWithGoogle, signOut } from "./account";
import { getSupabase, onlineAvailable } from "./supabase-client";

/**
 * Who is at this device: nobody yet, a guest, or a Google account with the
 * name the table calls it. Only the name for now; the game history will be
 * attached to the account later.
 */

export type AccountKind = "none" | "guest" | "google";

interface AccountState {
  ready: boolean;
  kind: AccountKind;
  email: string | null;
  /** Profile name of a Google account; null for a guest or an account that has not chosen one. */
  displayName: string | null;
  busy: boolean;
  error: string | null;
  /** Reads the current session once and follows every later sign-in or sign-out. */
  start: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<boolean>;
  clearError: () => void;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let started = false;

export const useAccountStore = create<AccountState>((set, get) => {
  const refresh = async (session: { user: { is_anonymous?: boolean; email?: string } } | null) => {
    if (!session) {
      set({ ready: true, kind: "none", email: null, displayName: null });
      return;
    }
    const kind: AccountKind = session.user.is_anonymous ? "guest" : "google";
    set({ ready: true, kind, email: session.user.email ?? null });
    if (kind !== "google") {
      set({ displayName: null });
      return;
    }
    try {
      const profile = await fetchMyProfile();
      set({ displayName: profile?.displayName ?? null });
    } catch (error) {
      set({ error: `Profil illisible : ${describeError(error)}` });
    }
  };

  return {
    ready: !onlineAvailable,
    kind: "none",
    email: null,
    displayName: null,
    busy: false,
    error: null,

    start: () => {
      if (started || !onlineAvailable) return;
      started = true;
      const supabase = getSupabase();
      void supabase.auth.getSession().then(({ data }) => refresh(data.session));
      // Deferred: the auth client must not be called back from inside its own listener.
      supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => void refresh(session), 0);
      });
    },

    signInWithGoogle: async () => {
      set({ busy: true, error: null });
      try {
        await signInWithGoogle();
      } catch (error) {
        set({ busy: false, error: describeError(error) });
      }
    },

    signOut: async () => {
      set({ busy: true, error: null });
      try {
        await signOut();
      } catch (error) {
        set({ error: describeError(error) });
      } finally {
        set({ busy: false });
      }
    },

    saveDisplayName: async (displayName) => {
      if (get().kind !== "google") return false;
      set({ busy: true, error: null });
      try {
        await saveProfile({ displayName: displayName.trim() });
        set({ displayName: displayName.trim() });
        return true;
      } catch (error) {
        set({ error: describeError(error) });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});
