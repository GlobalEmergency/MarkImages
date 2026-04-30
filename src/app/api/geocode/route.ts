import { NextRequest, NextResponse } from "next/server";

import { geocodeRateLimiter } from "@/lib/rate-limit";

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
    autonomous_community?: string;
    country?: string;
  };
  source: "google";
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = geocodeRateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const city = searchParams.get("city");
    const postalCode = searchParams.get("postalCode");
    const country = searchParams.get("country") || "España";

    if (!query) {
      return NextResponse.json({ error: "Query requerida" }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      console.error("[Geocode API] GOOGLE_MAPS_API_KEY not configured");
      return NextResponse.json({ error: "Geocoding service not configured" }, { status: 503 });
    }

    // Detect if user is searching for a specific house number
    const numberMatch = query.match(/\b(\d+)\b/);
    const searchedNumber = numberMatch ? numberMatch[1] : null;

    // Build the full query using geographic context from DEA data
    // Priority: use provided city/postalCode, only add country if not already present
    const normalizedQuery = query.toLowerCase();
    const queryParts = [query];

    // Add postal code if provided and not already in query
    if (postalCode && !normalizedQuery.includes(postalCode.toLowerCase())) {
      queryParts.push(postalCode);
    }

    // Add city if provided and not already in query
    if (city && !normalizedQuery.includes(city.toLowerCase())) {
      queryParts.push(city);
    }

    // Add country only if not already present in query
    if (!normalizedQuery.includes("españa") && !normalizedQuery.includes("spain")) {
      queryParts.push(country);
    }

    const fullQuery = queryParts.join(", ");

    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      fullQuery
    )}&key=${googleApiKey}&language=es&region=es`;

    const googleResponse = await fetch(googleUrl);
    const googleData = await googleResponse.json();

    if (googleData.status !== "OK") {
      if (googleData.status === "ZERO_RESULTS") {
        return NextResponse.json([]);
      }
      console.error(
        `[Geocode API] Google API error: ${googleData.status} - ${googleData.error_message || "Unknown"}`
      );
      return NextResponse.json({ error: `Geocoding error: ${googleData.status}` }, { status: 500 });
    }

    const results: NormalizedResult[] = googleData.results
      .slice(0, 10)
      .map((result: GoogleGeocodingResult) => normalizeGoogleResult(result));

    // Sort: Prioritize exact number matches, then presence of house numbers
    const sortedResults = results.sort((a, b) => {
      // If user searched for a specific number, prioritize exact matches
      if (searchedNumber) {
        const aMatchesNumber = a.address.house_number === searchedNumber;
        const bMatchesNumber = b.address.house_number === searchedNumber;

        if (aMatchesNumber && !bMatchesNumber) return -1;
        if (!aMatchesNumber && bMatchesNumber) return 1;
      }

      // Then by house number presence
      const aHasNumber = !!a.address.house_number;
      const bHasNumber = !!b.address.house_number;
      if (aHasNumber && !bHasNumber) return -1;
      if (!aHasNumber && bHasNumber) return 1;

      return 0;
    });

    return NextResponse.json(sortedResults);
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

  // Extract autonomous community (administrative_area_level_1 in Spain)
  const autonomousCommunity = components.find((c) =>
    c.types.includes("administrative_area_level_1")
  )?.long_name;

  // Extract country
  const country = components.find((c) => c.types.includes("country"))?.long_name;

  return {
    display_name: result.formatted_address,
    lat: result.geometry.location.lat.toString(),
    lon: result.geometry.location.lng.toString(),
    address: {
      road: route,
      house_number: streetNumber,
      postcode: postalCode,
      city: locality,
      autonomous_community: autonomousCommunity,
      country: country,
    },
    source: "google",
  };
}
