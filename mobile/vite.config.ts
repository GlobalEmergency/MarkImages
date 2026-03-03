/// <reference types="vitest" />

import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), legacy()],

  server: {
    // Proxy API calls to the production server in dev mode.
    // This avoids CORS issues since the browser sees same-origin requests.
    // In production builds (device), CapacitorHttp handles CORS natively.
    proxy: {
      "/api": {
        target: "https://deamap.es",
        changeOrigin: true,
        secure: true,
      },
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
