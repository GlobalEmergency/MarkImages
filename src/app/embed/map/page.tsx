/**
 * /embed/map â€” embeddable map page.
 *
 * Accepted search params:
 *   city   â€” center on a Spanish city (geocoded server-side via Nominatim)
 *   lat    â€” latitude
 *   lng    â€” longitude
 *   zoom   â€” initial zoom level (default: 14)
 *   theme  â€” reserved for future use (light|dark, default: light)
 *
 * The map component is loaded dynamically with ssr:false because
 * Leaflet needs `window` (not available during server rendering).
 */

import EmbedMapLoader from "./EmbedMapLoader";
import type { Metadata } from "next";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EmbedMapPageProps {
  searchParams: Promise<{
    city?: string;
    lat?: string;
    lng?: string;
    zoom?: string;
    theme?: string;
  }>;
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]; // Madrid
const DEFAULT_ZOOM = 12;

async function geocodeCity(city: string): Promise<{ center: [number, number]; label: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},Spain&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DeaMap-EmbedWidget/1.0 (info@globalemergency.online)" },
      next: { revalidate: 86400 }, // cache 24 h
    });

    if (!res.ok) return { center: DEFAULT_CENTER, label: city };

    const data: GeocodingResult[] = await res.json();
    if (data.length === 0) return { center: DEFAULT_CENTER, label: city };

    return {
      center: [parseFloat(data[0].lat), parseFloat(data[0].lon)],
      label: city,
    };
  } catch {
    return { center: DEFAULT_CENTER, label: city };
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Metadata
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function generateMetadata({ searchParams }: EmbedMapPageProps): Promise<Metadata> {
  const params = await searchParams;
  const city = params.city ?? "EspaÃ±a";
  return {
    title: `Mapa de DEAs â€” ${city} | DeaMap`,
    robots: { index: false, follow: false },
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Page (Server Component)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default async function EmbedMapPage({ searchParams }: EmbedMapPageProps) {
  const params = await searchParams;

  let center = DEFAULT_CENTER;
  let zoom = DEFAULT_ZOOM;
  let cityLabel: string | undefined;

  // Priority 1: explicit lat/lng
  if (params.lat && params.lng) {
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      center = [lat, lng];
      zoom = 15;
    }
  }

  // Priority 2: city name (server-side geocoding)
  if (params.city && center === DEFAULT_CENTER) {
    const result = await geocodeCity(params.city);
    center = result.center;
    cityLabel = result.label;
    zoom = 14;
  }

  // Optional zoom override
  if (params.zoom) {
    const z = parseInt(params.zoom, 10);
    if (!isNaN(z) && z >= 1 && z <= 20) zoom = z;
  }

  return (
    <div className="w-screen h-screen overflow-hidden">
      <EmbedMapLoader center={center} zoom={zoom} cityLabel={cityLabel} />
    </div>
  );
}
