import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The bot campaigns keep their workers busy for minutes: separate processes stay responsive to Vitest
    // where threads, starved, time out on its calls.
    pool: "forks",
  },
});
