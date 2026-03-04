/// <reference types="vitest" />

import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Support older Android WebViews (globalThis, optional chaining, etc.)
      targets: ["defaults", "Chrome >= 61", "Android >= 5"],
    }),
  ],

  server: {
    // Proxy API calls to avoid CORS issues in dev mode.
    // In production builds (device), CapacitorHttp handles CORS natively.
    // Override with: VITE_API_PROXY_TARGET=http://localhost:3000 npm run dev
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "https://deamap.es",
        changeOrigin: true,
        secure: true,
      },
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
  },
});
