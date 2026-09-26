import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Production is served at the root of redcups.leeeight.site; the pre-prod
  // preview on GitHub Pages lives under /red-cups/ and sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (id.includes("/node_modules/@supabase/")) return "supabase";
          return undefined;
        },
      },
    },
  },
});
