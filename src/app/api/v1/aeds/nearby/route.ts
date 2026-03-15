/**
 * Public API v1: GET /api/v1/aeds/nearby
 *
 * Find nearest AEDs to a location using PostGIS spatial queries.
 * Rate limited to 60 requests per minute per IP.
 *
 * Query params:
 * - lat: latitude (required, -90 to 90)
 * - lng: longitude (required, -180 to 180)
 * - limit: max results (optional, default: 10, max: 50)
 * - radius: search radius in km (optional, default: 5, max: 50)
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";
import { publicApiRateLimiter } from "@/lib/rate-limit-public-api";

interface NearbyAedRow {
  id: string;
  distance_km: number;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = publicApiRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);

    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 50);
    const radius = Math.min(Math.max(parseFloat(searchParams.get("radius") || "5"), 0.1), 50);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        {
          error: "invalid_parameters",
          message: "Both 'lat' and 'lng' query parameters are required and must be valid numbers.",
          docs: "https://deamap.es/api/docs",
        },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          error: "invalid_coordinates",
          message: "Latitude must be between -90 and 90, longitude between -180 and 180.",
          docs: "https://deamap.es/api/docs",
        },
        { status: 400 }
      );
    }

    const radiusMeters = radius * 1000;

    const nearbyAeds = await prisma.$queryRaw<NearbyAedRow[]>`
      SELECT
        a.id,
        ST_Distance(
          a.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM aeds a
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.geom IS NOT NULL
        AND ST_DWithin(
          a.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY distance_km ASC
      LIMIT ${limit}
    `;

    const aedIds = nearbyAeds.map((a) => a.id);
    const distanceMap = new Map(nearbyAeds.map((a) => [a.id, Number(a.distance_km)]));

    const fullAeds =
      aedIds.length > 0
        ? await prisma.aed.findMany({
            where: { id: { in: aedIds } },
            select: {
              id: true,
              code: true,
              name: true,
              establishment_type: true,
              latitude: true,
              longitude: true,
              published_at: true,
              publication_mode: true,
              location: {
                select: {
                  street_type: true,
                  street_name: true,
                  street_number: true,
                  postal_code: true,
                  access_instructions: true,
                  district_name: true,
                  neighborhood_name: true,
                  city_name: true,
                },
              },
              schedule: {
                select: {
                  has_24h_surveillance: true,
                  weekday_opening: true,
                  weekday_closing: true,
                },
              },
            },
          })
        : [];

    const sortedAeds = fullAeds.sort(
      (a, b) => (distanceMap.get(a.id) ?? Infinity) - (distanceMap.get(b.id) ?? Infinity)
    );

    const data = sortedAeds
      .map((aed) => filterAedByPublicationMode(aed as AedFullData))
      .filter((aed): aed is NonNullable<typeof aed> => aed !== null)
      .map((aed) => ({
        id: aed.id,
        name: aed.name,
        latitude: aed.latitude,
        longitude: aed.longitude,
        distance_km: aed.id ? Math.round((distanceMap.get(aed.id) ?? 0) * 1000) / 1000 : 0,
        address: aed.location
          ? {
              street: [
                aed.location.street_type,
                aed.location.street_name,
                aed.location.street_number,
              ]
                .filter(Boolean)
                .join(" "),
              city: aed.location.city_name || null,
              district: aed.location.district_name || null,
              postal_code: aed.location.postal_code || null,
              access_instructions: aed.location.access_instructions || null,
            }
          : null,
        schedule: aed.schedule
          ? {
              is_24h: aed.schedule.has_24h_surveillance,
              weekday_opening: aed.schedule.weekday_opening,
              weekday_closing: aed.schedule.weekday_closing,
            }
          : null,
        web_url: `https://deamap.es/dea/${aed.id}`,
      }));

    const response = NextResponse.json({
      data,
      meta: {
        total: data.length,
        query: { lat, lng, radius_km: radius, limit },
        api_version: "v1",
      },
    });

    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    response.headers.set("Access-Control-Allow-Origin", "*");

    return response;
  } catch (error) {
    console.error("[Public API v1] Error fetching nearby AEDs:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
