"use client";

import { useEffect } from "react";

import { trackEventDirect, AnalyticsCategory } from "@/hooks/useAnalytics";

/**
 * Listens for deep-link / universal-link opens via @capacitor/app.
 *
 * When the app is opened through a URL like:
 *   - https://deamap.es/open?source=emerkit   (Universal Link - iOS)
 *   - deamap://open?source=emerkit            (Custom scheme - Android)
 *
 * …this component fires a GA4 event so we can track the source.
 *
 * On the web (non-Capacitor) this is a no-op.
 */
export default function DeepLinkListener() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        // Dynamic import — these packages only exist in the Capacitor mobile
        // build, not in the Next.js web project.  The catch block handles the
        // "module not found" error on web gracefully.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { App } = (await import("@capacitor/app" as any)) as {
          App: {
            getLaunchUrl: () => Promise<{ url: string } | undefined>;
            addListener: (
              event: string,
              cb: (data: { url: string }) => void
            ) => Promise<{ remove: () => void }>;
          };
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { Capacitor } = (await import("@capacitor/core" as any)) as {
          Capacitor: { isNativePlatform: () => boolean };
        };

        if (!Capacitor.isNativePlatform()) return;

        // Track the source from the initial URL that launched the app (cold start)
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          trackDeepLinkOpen(launchUrl.url);
        }

        // Listen for URLs that open the app while it's already running (warm start)
        const listener = await App.addListener("appUrlOpen", (data) => {
          trackDeepLinkOpen(data.url);
        });

        cleanup = () => {
          listener.remove();
        };
      } catch {
        // @capacitor/app not available (pure web) — silently ignore
      }
    }

    init();

    return () => {
      cleanup?.();
    };
  }, []);

  // This component renders nothing
  return null;
}

function trackDeepLinkOpen(url: string) {
  try {
    const parsed = new URL(url);
    const source = parsed.searchParams.get("source") || "direct";
    const path = parsed.pathname;

    trackEventDirect({
      action: "app_open_deeplink",
      category: AnalyticsCategory.NAVIGATION,
      label: source,
      deep_link_url: url,
      deep_link_path: path,
      deep_link_source: source,
    });
  } catch {
    // Malformed URL — still track with raw value
    trackEventDirect({
      action: "app_open_deeplink",
      category: AnalyticsCategory.NAVIGATION,
      label: "unknown",
      deep_link_url: url,
    });
  }
}
