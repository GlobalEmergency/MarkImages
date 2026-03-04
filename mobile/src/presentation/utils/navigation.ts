import { Capacitor } from "@capacitor/core";

/**
 * Build a navigation URL that opens the native maps application.
 *
 * - iOS: uses Apple Maps `maps:` scheme (universal on all iOS devices).
 * - Android: uses a Google Maps HTTPS URL. The `geo:` URI scheme does NOT
 *   work reliably with `window.open("geo:…", "_system")` on older WebViews
 *   (Chrome < 80) — the WebView tries to handle the URI internally instead
 *   of delegating to the system intent handler.  An HTTPS URL always opens
 *   in the system browser, and if Google Maps is installed it intercepts it.
 */
export function buildNavigationUrl(lat: number, lng: number, name: string): string {
  if (Capacitor.getPlatform() === "ios") {
    return `maps:?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`;
  }
  // Android — HTTPS URL works on all WebView versions
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function buildTelUrl(phone: string): string {
  return `tel:${phone}`;
}
