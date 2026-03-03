import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "es.deamap.mobile",
  appName: "DeaMap",
  webDir: "dist",
  server: {
    // hostname must match the real domain so iOS/Android credential managers
    // can associate saved passwords with this app (autofill).
    hostname: "deamap.es",
    androidScheme: "https",
  },
  plugins: {
    // CapacitorHttp patches window.fetch on native platforms to route
    // through the native HTTP layer, which bypasses CORS entirely.
    // In dev (browser), the Vite proxy handles CORS instead.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "dark" as const,
    },
  },
};

export default config;
