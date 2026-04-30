"use client";

import { Download, MapPin, Navigation as NavigationIcon, Smartphone, Wifi, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAnalytics } from "@/hooks/useAnalytics";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=es.deamap.mobile";
const APP_STORE_URL = "https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634";

function useDevicePlatform() {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
    } else if (/android/.test(ua)) {
      setPlatform("android");
    }
  }, []);

  return platform;
}

/* ================================================================
   Contextual App Download Prompt â€” hook + component
   ================================================================ */

export type PromptContext = "search_results" | "dea_detail" | "directions" | "geolocation";

const PROMPT_MESSAGES: Record<
  PromptContext,
  { title: string; subtitle: string; icon: typeof Download }
> = {
  search_results: {
    title: "Encuentra DEAs mas rapido",
    subtitle: "Busca desfibriladores al instante con la app",
    icon: MapPin,
  },
  dea_detail: {
    title: "Navega hasta este DEA",
    subtitle: "La app te guia paso a paso hasta el desfibrilador",
    icon: NavigationIcon,
  },
  directions: {
    title: "Mejor navegacion con la app",
    subtitle: "Te lleva directamente al DEA mas cercano",
    icon: NavigationIcon,
  },
  geolocation: {
    title: "Tu ubicacion, siempre lista",
    subtitle: "GPS rapido y preciso con la app nativa",
    icon: Wifi,
  },
};

const COOLDOWN_24H = 24 * 60 * 60 * 1000;
const COOLDOWN_30D = 30 * 24 * 60 * 60 * 1000;

// Session-level flag: only show 1 prompt per page session
let sessionPromptShown = false;

function isCoolingDown(context: PromptContext): boolean {
  try {
    // Permanent dismiss check
    const permanent = localStorage.getItem("app-prompt-permanent-dismiss");
    if (permanent) {
      const ts = parseInt(permanent, 10);
      if (Date.now() - ts < COOLDOWN_30D) return true;
    }
    // Per-context 24h cooldown
    const contextTs = localStorage.getItem(`app-prompt-dismiss-${context}`);
    if (contextTs) {
      const ts = parseInt(contextTs, 10);
      if (Date.now() - ts < COOLDOWN_24H) return true;
    }
    // Smart banner dismiss doesn't block contextual prompts
  } catch {
    return false;
  }
  return false;
}

/**
 * Hook to manage contextual app download prompts.
 * Returns a trigger function and the component to render.
 */
export function useAppDownloadPrompt() {
  const [visible, setVisible] = useState(false);
  const [context, setContext] = useState<PromptContext | null>(null);
  const platform = useDevicePlatform();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(
    (ctx: PromptContext, delayMs = 0) => {
      if (platform === "desktop") return;
      if (sessionPromptShown) return;
      if (isCoolingDown(ctx)) return;

      const show = () => {
        // Re-check in case something changed during delay
        if (sessionPromptShown) return;
        sessionPromptShown = true;
        setContext(ctx);
        setVisible(true);
      };

      if (delayMs > 0) {
        timerRef.current = setTimeout(show, delayMs);
      } else {
        show();
      }
    },
    [platform]
  );

  const dismiss = useCallback(
    (permanent = false) => {
      setVisible(false);
      if (context) {
        localStorage.setItem(`app-prompt-dismiss-${context}`, String(Date.now()));
      }
      if (permanent) {
        localStorage.setItem("app-prompt-permanent-dismiss", String(Date.now()));
      }
    },
    [context]
  );

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { trigger, dismiss, cancelPending, visible, context, platform };
}

/**
 * Bottom-sheet style prompt that appears over content on mobile.
 */
export function AppDownloadPrompt({
  visible,
  context,
  platform,
  onDismiss,
}: {
  visible: boolean;
  context: PromptContext | null;
  platform: "ios" | "android" | "desktop";
  onDismiss: (permanent?: boolean) => void;
}) {
  const { trackExternalLink, trackButtonClick } = useAnalytics();

  if (!visible || !context || platform === "desktop") return null;

  const msg = PROMPT_MESSAGES[context];
  const Icon = msg.icon;
  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = platform === "ios" ? "App Store" : "Google Play";

  return (
    <div className="fixed inset-0 z-[1999] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-modal-backdrop"
        onClick={() => {
          trackButtonClick("app_prompt_backdrop_dismiss", context);
          onDismiss();
        }}
      />

      {/* Bottom sheet */}
      <div className="relative w-full max-w-lg mx-2 mb-2 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              trackButtonClick("app_prompt_close", context);
              onDismiss();
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>

          <div className="px-5 pt-2 pb-5">
            {/* Icon + text */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">{msg.title}</h3>
                <p className="text-sm text-gray-500">{msg.subtitle}</p>
              </div>
            </div>

            {/* Features pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                GPS nativo
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Navegacion
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                Sin conexion
              </span>
            </div>

            {/* CTA button */}
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackExternalLink(storeUrl, `App Prompt - ${storeName}`, `app_prompt_${context}`);
                trackButtonClick("app_prompt_download", context);
              }}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
            >
              <Download className="w-5 h-5" />
              Descargar gratis en {storeName}
            </a>

            {/* Permanent dismiss */}
            <button
              onClick={() => {
                trackButtonClick("app_prompt_permanent_dismiss", context);
                onDismiss(true);
              }}
              className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sticky smart banner for mobile users â€” appears after 3s with app store styling.
 * Dismissible with localStorage persistence.
 */
export function AppSmartBanner() {
  const [show, setShow] = useState(false);
  const platform = useDevicePlatform();
  const { trackExternalLink, trackButtonClick } = useAnalytics();

  useEffect(() => {
    if (platform === "desktop") return;
    const dismissedAt = localStorage.getItem("app-banner-dismissed");
    if (dismissedAt) {
      const ts = parseInt(dismissedAt, 10);
      if (Date.now() - ts < COOLDOWN_24H) return;
    }

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [platform]);

  if (!show || platform === "desktop") return null;

  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = platform === "ios" ? "App Store" : "Google Play";
  const isIos = platform === "ios";

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("app-banner-dismissed", String(Date.now()));
    trackButtonClick("smart_banner_dismiss", "smart_banner");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] animate-slide-down">
      {/* Store-style banner */}
      <div className="bg-gray-50 border-b border-gray-200 shadow-lg">
        <div className="flex items-center gap-3 px-3 py-3">
          {/* Close */}
          <button
            onClick={handleDismiss}
            className="p-1 -ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* App icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-[14px] shadow-md overflow-hidden border border-gray-200">
            <Image
              src="/DeaMap_Logo.png"
              alt="DeaMap"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>

          {/* App info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">DeaMap - Desfibriladores</p>
            <p className="text-xs text-gray-500 truncate">
              {isIos ? "En el App Store" : "En Google Play"}
            </p>
            {/* Star rating */}
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="w-3 h-3 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-[10px] text-gray-400">GRATIS</span>
            </div>
          </div>

          {/* CTA button */}
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackExternalLink(storeUrl, `Smart Banner - ${storeName}`, "smart_banner")
            }
            className={`flex-shrink-0 text-sm font-bold px-5 py-1.5 rounded-full transition-colors ${
              isIos
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            VER
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Full promotional section with store badges â€” for the home page info area.
 */
export function AppDownloadSection() {
  const { trackExternalLink } = useAnalytics();

  return (
    <section className="max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-red-500 rounded-full blur-3xl" />
        </div>

        <div className="relative p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Text content */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Smartphone className="w-3.5 h-3.5" />
                DISPONIBLE EN TU MOVIL
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Lleva DeaMap en tu bolsillo
              </h2>

              <p className="text-gray-300 text-lg mb-2">
                Encuentra el desfibrilador mas cercano al instante.
              </p>

              <ul className="text-gray-400 text-sm space-y-1.5 mb-6">
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  Busqueda por GPS en tiempo real
                </li>
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  Navegacion hasta el DEA mas cercano
                </li>
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  Funciona sin conexion
                </li>
              </ul>

              {/* Store badges */}
              <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackExternalLink(APP_STORE_URL, "App Store Badge", "app_download_section")
                  }
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <AppStoreBadge />
                </a>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackExternalLink(PLAY_STORE_URL, "Google Play Badge", "app_download_section")
                  }
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <GooglePlayBadge />
                </a>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex-shrink-0 relative">
              <div className="w-52 h-[420px] md:w-56 md:h-[450px] relative">
                {/* Phone frame */}
                <div className="absolute inset-0 bg-black rounded-[2.5rem] shadow-2xl border border-gray-700 overflow-hidden">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-10" />
                  {/* Screen */}
                  <div className="absolute inset-[3px] rounded-[2.3rem] overflow-hidden">
                    <Image
                      src="/app-store/screenshot-01-mapa.png"
                      alt="DeaMap app - Mapa de desfibriladores"
                      fill
                      className="object-cover"
                      sizes="224px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Compact store links for the footer.
 */
export function AppStoreFooterLinks() {
  const { trackExternalLink } = useAnalytics();

  return (
    <div>
      <h3 className="font-bold text-lg mb-3 text-white">App Movil</h3>
      <p className="text-gray-300 text-sm mb-3">Descarga DeaMap gratis</p>
      <div className="flex flex-col gap-2">
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackExternalLink(APP_STORE_URL, "App Store (footer)", "footer")}
          className="transition-transform hover:scale-105 inline-block"
        >
          <AppStoreBadge className="h-9" />
        </a>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackExternalLink(PLAY_STORE_URL, "Google Play (footer)", "footer")}
          className="transition-transform hover:scale-105 inline-block"
        >
          <GooglePlayBadge className="h-9" />
        </a>
      </div>
    </div>
  );
}

/* ---------- SVG Store Badges ---------- */

function AppStoreBadge({ className = "h-11" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="40" rx="5" fill="#000" />
      <rect x="0.5" y="0.5" width="119" height="39" rx="4.5" stroke="#A6A6A6" fill="none" />
      <text
        x="42.5"
        y="13"
        fill="#fff"
        fontSize="6"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
      >
        Disponible en
      </text>
      <text
        x="42.5"
        y="27"
        fill="#fff"
        fontSize="12"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        App Store
      </text>
      {/* Apple logo simplified */}
      <g transform="translate(14, 8)" fill="#fff">
        <path d="M11.5 1.5c-1.1 1.3-2.9 1.1-2.9 1.1s-.2-1.6 1-2.6c1.1-1 2.5-.8 2.5-.8s.2 1.3-.6 2.3zm-.6 2.8c1.5 0 2.8 1.2 2.8 1.2s-1.5.8-1.5 2.8c0 2.3 2 3 2 3s-1.4 4-3.3 4c-.9 0-1-.6-2.2-.6-1.2 0-1.5.6-2.2.6C4.5 15.3 2 11.5 2 8.5c0-2.7 1.7-4.2 3.2-4.2 1.2 0 2 .8 2.4.8.5 0 1.5-.8 2.8-.8h.5z" />
      </g>
    </svg>
  );
}

function GooglePlayBadge({ className = "h-11" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 135 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="135" height="40" rx="5" fill="#000" />
      <rect x="0.5" y="0.5" width="134" height="39" rx="4.5" stroke="#A6A6A6" fill="none" />
      <text
        x="50"
        y="13"
        fill="#fff"
        fontSize="5.5"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.3"
      >
        DISPONIBLE EN
      </text>
      <text
        x="50"
        y="27"
        fill="#fff"
        fontSize="11"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        Google Play
      </text>
      {/* Play triangle */}
      <g transform="translate(12, 7)">
        <defs>
          <linearGradient id="play-bl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00C3FF" />
            <stop offset="100%" stopColor="#1BA1E2" />
          </linearGradient>
          <linearGradient id="play-gr" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F076" />
            <stop offset="100%" stopColor="#00C853" />
          </linearGradient>
          <linearGradient id="play-rd" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF3A44" />
            <stop offset="100%" stopColor="#C31162" />
          </linearGradient>
          <linearGradient id="play-yl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD500" />
            <stop offset="100%" stopColor="#FFAA00" />
          </linearGradient>
        </defs>
        <path d="M1 1.5L15 13 1 24.5z" fill="url(#play-bl)" />
        <path d="M1 1.5l14 11.5 5-4L6.5 0z" fill="url(#play-gr)" />
        <path d="M1 24.5l14-11.5 5 4L6.5 26z" fill="url(#play-rd)" />
        <path d="M20 9L6.5 0h0L1 1.5l14 11.5z" fill="url(#play-yl)" opacity="0.7" />
      </g>
    </svg>
  );
}
