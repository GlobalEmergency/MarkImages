/**
 * API Route: /api/aeds/nearby
 *
 * Find nearest AEDs to a specific location using PostGIS spatial queries.
 * Leverages the spatial index on the geom column for fast lookups.
 * Optimized for emergency situations.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";

interface NearbyAedRow {
  id: string;
  distance_km: number;
}

/**
 * GET /api/aeds/nearby
 * Find nearest AEDs to a location using PostGIS ST_DWithin + ST_Distance
 *
 * Query params:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - limit: max number of results (optional, default: 10, max: 50)
 * - radius: search radius in km (optional, default: 5, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate parameters
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const radius = Math.min(parseFloat(searchParams.get("radius") || "5"), 50);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          message: "Both lat and lng are required and must be valid numbers",
        },
        { status: 400 }
      );
    }

    // Validate lat/lng ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid coordinates",
          message: "Latitude must be between -90 and 90, longitude between -180 and 180",
        },
        { status: 400 }
      );
    }

    // Convert radius from km to meters for ST_DWithin (geography uses meters)
    const radiusMeters = radius * 1000;

    // Use PostGIS ST_DWithin for spatial filtering + ST_Distance for sorting.
    // This leverages the spatial index on the geom column instead of
    // fetching all AEDs and calculating Haversine distances in JS.
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

    // Build distance lookup from PostGIS results
    const aedIds = nearbyAeds.map((a) => a.id);
    const distanceMap = new Map(nearbyAeds.map((a) => [a.id, Number(a.distance_km)]));

    // Fetch full related data only for the matched AEDs
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
                  location_details: true,
                },
              },
              schedule: {
                select: {
                  has_24h_surveillance: true,
                  has_restricted_access: true,
                  weekday_opening: true,
                  weekday_closing: true,
                  saturday_opening: true,
                  saturday_closing: true,
                  sunday_opening: true,
                  sunday_closing: true,
                },
              },
              responsible: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              images: {
                select: {
                  id: true,
                  type: true,
                  original_url: true,
                  processed_url: true,
                  thumbnail_url: true,
                  order: true,
                },
                where: {
                  is_verified: true,
                },
                orderBy: {
                  order: "asc",
                },
                take: 5,
              },
            },
          })
        : [];

    // Re-sort by PostGIS distance and apply publication filter
    const sortedAeds = fullAeds.sort(
      (a, b) => (distanceMap.get(a.id) ?? Infinity) - (distanceMap.get(b.id) ?? Infinity)
    );

    const filteredAeds = sortedAeds
      .map((aed) => filterAedByPublicationMode(aed as AedFullData))
      .filter((aed): aed is NonNullable<typeof aed> => aed !== null)
      .map((aed) => ({
        ...aed,
        distance: aed.id ? (distanceMap.get(aed.id) ?? 0) : 0,
      }));

    const response = NextResponse.json({
      success: true,
      data: filteredAeds,
      query: {
        lat,
        lng,
        radius,
        limit,
      },
      stats: {
        found: filteredAeds.length,
        searchRadius: radius,
      },
    });

    // Cache nearby results for 60s, allow stale for 5min while revalidating
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

    return response;
  } catch (error) {
    console.error("Error fetching nearby AEDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch nearby AEDs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
