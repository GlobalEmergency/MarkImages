import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "es.deamap.mobile",
  appName: "DeaMap",
  webDir: "dist",
  server: {
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
