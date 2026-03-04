/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    // Target Chrome 66+ to support older Android WebViews (Android 8+).
    // Chrome 66 supports ES modules but lacks newer syntax (?.  ??  ??= etc.).
    // esbuild transpiles these automatically for this target.
    // Runtime API polyfills (globalThis, queueMicrotask) are in index.html.
    //
    // NOTE: @vitejs/plugin-legacy was removed because it generates a dual
    // module/nomodule bundle, but Chrome 66+ loads the modern bundle (since
    // it supports ES modules) — defeating the purpose. A single bundle
    // targeting chrome66 is simpler and correct for a Capacitor WebView app.
    target: "chrome66",
  },

  plugins: [react()],

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
