import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      // Dev proxy so the SPA talks to the Django/DRF API without CORS friction.
      "/api": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Exclude Playwright e2e specs — those run via `npm run e2e`, not vitest.
    exclude: ["**/node_modules/**", "**/e2e/**", "**/*.spec.ts"],
  },
});
