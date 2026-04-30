"use client";

/**
 * /embed â€” Iframe snippet generator.
 *
 * Allows organizations, municipalities, and any third-party to
 * configure the embed options and copy the ready-to-use <iframe>
 * HTML snippet to their clipboard.
 */

import { useState, useCallback } from "react";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FilterMode = "city" | "coordinates";

interface EmbedConfig {
  filterMode: FilterMode;
  city: string;
  lat: string;
  lng: string;
  zoom: string;
  width: string;
  height: string;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_URL = "https://deamap.es";

function buildEmbedUrl(config: EmbedConfig): string {
  const params = new URLSearchParams();

  if (config.filterMode === "city" && config.city.trim()) {
    params.set("city", config.city.trim());
  } else if (config.filterMode === "coordinates" && config.lat.trim() && config.lng.trim()) {
    params.set("lat", config.lat.trim());
    params.set("lng", config.lng.trim());
  }

  if (config.zoom && config.zoom !== "14") {
    params.set("zoom", config.zoom);
  }

  const qs = params.toString();
  return `${BASE_URL}/embed/map${qs ? `?${qs}` : ""}`;
}

function buildSnippet(config: EmbedConfig): string {
  const src = buildEmbedUrl(config);
  const city = config.filterMode === "city" && config.city.trim() ? config.city.trim() : "tu zona";

  return `<iframe
  src="${src}"
  width="${config.width}"
  height="${config.height}"
  frameborder="0"
  allow="geolocation"
  style="border:none;border-radius:8px;"
  title="Mapa de Desfibriladores (DEA) â€” ${city} | DeaMap"
  loading="lazy"
></iframe>`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function EmbedGeneratorPage() {
  const [config, setConfig] = useState<EmbedConfig>({
    filterMode: "city",
    city: "Madrid",
    lat: "",
    lng: "",
    zoom: "14",
    width: "100%",
    height: "450",
  });

  const [copied, setCopied] = useState(false);

  const snippet = buildSnippet(config);
  const previewUrl = buildEmbedUrl(config);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for old browsers
      const ta = document.createElement("textarea");
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [snippet]);

  const set = useCallback(<K extends keyof EmbedConfig>(key: K, value: EmbedConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span className="font-extrabold text-2xl text-gray-900">DeaMap</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generador de Mapa Integrable</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Configura las opciones y copia el cÃ³digo&nbsp;
            <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">&lt;iframe&gt;</code> para
            incrustar un mapa de desfibriladores en tu web.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* â”€â”€ Configuration panel â”€â”€ */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 text-lg">ConfiguraciÃ³n</h2>

            {/* Filter mode */}
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">Filtrar por</legend>
              <div className="flex gap-3">
                {(["city", "coordinates"] as FilterMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={`flex-1 cursor-pointer rounded-lg border-2 px-4 py-2.5 text-sm font-medium text-center transition-colors ${
                      config.filterMode === mode
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="filterMode"
                      value={mode}
                      checked={config.filterMode === mode}
                      onChange={() => set("filterMode", mode)}
                      className="sr-only"
                    />
                    {mode === "city" ? "Ciudad" : "Coordenadas"}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* City input */}
            {config.filterMode === "city" && (
              <div>
                <label
                  htmlFor="embed-city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Ciudad
                </label>
                <input
                  id="embed-city"
                  type="text"
                  value={config.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Ej: Madrid, Barcelona, Sevillaâ€¦"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Coordinates inputs */}
            {config.filterMode === "coordinates" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="embed-lat"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Latitud
                  </label>
                  <input
                    id="embed-lat"
                    type="number"
                    step="any"
                    value={config.lat}
                    onChange={(e) => set("lat", e.target.value)}
                    placeholder="40.4168"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="embed-lng"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Longitud
                  </label>
                  <input
                    id="embed-lng"
                    type="number"
                    step="any"
                    value={config.lng}
                    onChange={(e) => set("lng", e.target.value)}
                    placeholder="-3.7038"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Zoom */}
            <div>
              <label htmlFor="embed-zoom" className="block text-sm font-medium text-gray-700 mb-1">
                Zoom inicial: <span className="font-semibold text-blue-600">{config.zoom}</span>
              </label>
              <input
                id="embed-zoom"
                type="range"
                min={8}
                max={18}
                step={1}
                value={config.zoom}
                onChange={(e) => set("zoom", e.target.value)}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Alejado (8)</span>
                <span>Cercano (18)</span>
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="embed-width"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Ancho
                </label>
                <input
                  id="embed-width"
                  type="text"
                  value={config.width}
                  onChange={(e) => set("width", e.target.value)}
                  placeholder="100%"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="embed-height"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Alto (px)
                </label>
                <input
                  id="embed-height"
                  type="number"
                  value={config.height}
                  onChange={(e) => set("height", e.target.value)}
                  placeholder="450"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* â”€â”€ Preview + Snippet panel â”€â”€ */}
          <section className="flex flex-col gap-4">
            {/* Live preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
                <span className="ml-2 text-xs text-gray-400 font-mono truncate">{previewUrl}</span>
              </div>
              <iframe
                src={previewUrl}
                width="100%"
                height="280"
                frameBorder="0"
                allow="geolocation"
                style={{ border: "none", display: "block" }}
                title="Vista previa del mapa integrado"
                loading="lazy"
              />
            </div>

            {/* Snippet */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">CÃ³digo HTML</h2>
                <button
                  id="embed-copy-button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    copied
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  aria-live="polite"
                >
                  {copied ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Â¡Copiado!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar cÃ³digo
                    </>
                  )}
                </button>
              </div>

              <pre className="bg-gray-900 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono">
                <code>{snippet}</code>
              </pre>
            </div>

            {/* Info note */}
            <p className="text-xs text-gray-500 text-center px-2">
              El widget es gratuito y no requiere cuenta.{" "}
              <a
                href="https://deamap.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                MÃ¡s informaciÃ³n en deamap.es
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
