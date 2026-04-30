import type { Metadata } from "next";

const APP_STORE_URL = "https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=es.deamap.mobile";

export const metadata: Metadata = {
  title: "Abrir DeaMap",
  description: "Abre la app DeaMap o descÃ¡rgala en tu dispositivo.",
  robots: { index: false, follow: false },
};

/**
 * Smart redirect page for deep-linking into the DeaMap mobile app.
 *
 * Flow:
 *  1. On iOS, Universal Links (apple-app-site-association) will intercept
 *     https://deamap.es/open?source=X BEFORE this page even loads â€” opening the
 *     app directly.  If the app is NOT installed the page renders normally.
 *  2. On Android, we attempt an Intent URL which either opens the app or falls
 *     back silently.  After a short timeout we redirect to the Play Store.
 *  3. On desktop / unknown we show manual store links.
 *
 * The `source` query-param is forwarded to the app so it can be tracked.
 */
export default function OpenPage() {
  // Inline script runs immediately on the client to redirect ASAP.
  const redirectScript = `
(function() {
  var params = new URLSearchParams(window.location.search);
  var source = params.get('source') || 'direct';

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);

  if (isAndroid) {
    // Intent URL: opens the app if installed, otherwise does nothing.
    var intentUrl = 'intent://open?source=' + encodeURIComponent(source)
      + '#Intent;scheme=deamap;package=es.deamap.mobile;end';
    window.location.href = intentUrl;

    // Fallback: if the app didn't open, redirect to Play Store after 1.5s
    setTimeout(function() {
      window.location.href = '${PLAY_STORE_URL}';
    }, 1500);
  } else if (isIOS) {
    // On iOS, if we reach this page it means Universal Links didn't
    // intercept (app not installed). Redirect to App Store.
    window.location.href = '${APP_STORE_URL}';
  }
  // Desktop: page renders with manual links (no auto-redirect).
})();
`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Inline redirect script â€” runs before React hydration */}
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />

      {/* Visible fallback for desktop or slow connections */}
      <img
        src="/web-app-manifest-512x512.png"
        alt="DeaMap"
        width={120}
        height={120}
        className="rounded-2xl mb-6"
      />
      <h1 className="text-2xl font-bold mb-2">DeaMap</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Localiza desfibriladores cerca de ti. Descarga la app en tu dispositivo.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <a
          href={APP_STORE_URL}
          className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          App Store
        </a>
        <a
          href={PLAY_STORE_URL}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
          </svg>
          Google Play
        </a>
      </div>
    </div>
  );
}
