import { NextRequest, NextResponse } from "next/server";

interface GoogleGeocodingResult {
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface NormalizedResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    municipality?: string;
  };
  source: "google" | "osm";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Query requerida" }, { status: 400 });
    }

    const results: NormalizedResult[] = [];

    // 1. Try Google Geocoding API if key is available
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          query + ", Madrid, España"
        )}&key=${googleApiKey}&language=es&region=es`;

        const googleResponse = await fetch(googleUrl);
        const googleData = await googleResponse.json();

        if (googleData.status === "OK" && googleData.results) {
          const googleResults = googleData.results
            .slice(0, 5)
            .map((result: GoogleGeocodingResult) => normalizeGoogleResult(result));
          results.push(...googleResults);
        }
      } catch (error) {
        console.error("Error fetching from Google:", error);
        // Continue to OSM even if Google fails
      }
    }

    // 2. Fetch from OpenStreetMap Nominatim as fallback/supplement
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ", Madrid, España"
      )}&addressdetails=1&limit=5&countrycodes=es`;

      const osmResponse = await fetch(osmUrl, {
        headers: {
          "User-Agent": "DEA-Madrid-WebApp/1.0",
        },
      });
      const osmData = await osmResponse.json();

      const osmResults = osmData.map((result: any) => ({
        ...result,
        source: "osm" as const,
      }));

      results.push(...osmResults);
    } catch (error) {
      console.error("Error fetching from OSM:", error);
    }

    // 3. Deduplicate and prioritize results
    const deduplicatedResults = deduplicateResults(results);

    // 4. Sort: Google results first, then prioritize those with house numbers
    const sortedResults = deduplicatedResults.sort((a, b) => {
      // Google results first
      if (a.source === "google" && b.source !== "google") return -1;
      if (a.source !== "google" && b.source === "google") return 1;

      // Then by house number presence
      const aHasNumber = !!a.address.house_number;
      const bHasNumber = !!b.address.house_number;
      if (aHasNumber && !bHasNumber) return -1;
      if (!aHasNumber && bHasNumber) return 1;

      return 0;
    });

    return NextResponse.json(sortedResults.slice(0, 10));
  } catch (error) {
    console.error("Error in geocoding API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

function normalizeGoogleResult(result: GoogleGeocodingResult): NormalizedResult {
  const components = result.address_components;

  // Extract address components
  const streetNumber = components.find((c) => c.types.includes("street_number"))?.long_name;
  const route = components.find((c) => c.types.includes("route"))?.long_name;
  const postalCode = components.find((c) => c.types.includes("postal_code"))?.long_name;
  const locality =
    components.find((c) => c.types.includes("locality"))?.long_name ||
    components.find((c) => c.types.includes("administrative_area_level_2"))?.long_name;

  return {
    display_name: result.formatted_address,
    lat: result.geometry.location.lat.toString(),
    lon: result.geometry.location.lng.toString(),
    address: {
      road: route,
      house_number: streetNumber,
      postcode: postalCode,
      city: locality,
    },
    source: "google",
  };
}

function deduplicateResults(results: NormalizedResult[]): NormalizedResult[] {
  const seen = new Set<string>();
  const deduplicated: NormalizedResult[] = [];

  for (const result of results) {
    // Create a key based on coordinates (rounded to 5 decimal places)
    const lat = parseFloat(result.lat).toFixed(5);
    const lon = parseFloat(result.lon).toFixed(5);
    const key = `${lat},${lon}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(result);
    } else {
      // If duplicate, prefer Google result
      const existingIndex = deduplicated.findIndex((r) => {
        const eLat = parseFloat(r.lat).toFixed(5);
        const eLon = parseFloat(r.lon).toFixed(5);
        return `${eLat},${eLon}` === key;
      });

      if (existingIndex !== -1 && result.source === "google") {
        deduplicated[existingIndex] = result; // Replace with Google result
      }
    }
  }

  return deduplicated;
}
