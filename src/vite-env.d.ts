/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL; without it the game only offers local play. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. It grants nothing alone: every path is a checked function. */
  readonly VITE_SUPABASE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
