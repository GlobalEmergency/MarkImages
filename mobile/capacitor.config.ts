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
    // CapacitorHttp auto-patching of fetch is DISABLED because it does
    // NOT intercept requests to the same hostname as the WebView (deamap.es).
    // Instead, HttpClient calls CapacitorHttp.request() directly on native
    // to bypass the WebView's local server interception.
    CapacitorHttp: {
      enabled: false,
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
