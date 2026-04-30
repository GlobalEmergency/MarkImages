"use client";

/**
 * EmbedMapLoader â€” client boundary for the dynamic Leaflet import.
 *
 * `ssr: false` is only allowed inside Client Components with Next.js 15+
 * Turbopack. This thin wrapper satisfies that constraint while keeping
 * the page itself a Server Component (for server-side geocoding).
 */

import dynamic from "next/dynamic";
import type { EmbedMapClientProps } from "./EmbedMapClient";

const EmbedMapClient = dynamic(() => import("./EmbedMapClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <svg
          className="w-8 h-8 animate-spin text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm font-medium">Cargando mapaâ€¦</span>
      </div>
    </div>
  ),
});

export default function EmbedMapLoader(props: EmbedMapClientProps) {
  return <EmbedMapClient {...props} />;
}
