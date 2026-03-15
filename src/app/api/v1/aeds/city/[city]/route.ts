/**
 * Public API v1: GET /api/v1/aeds/city/:city
 *
 * Get all AEDs in a city. City name is case-insensitive.
 * Rate limited to 60 requests per minute per IP.
 *
 * Query params:
 * - limit: max results (optional, default: 100, max: 500)
 * - offset: pagination offset (optional, default: 0)
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { publicApiRateLimiter } from "@/lib/rate-limit-public-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ city: string }> }) {
  const rateLimitResponse = publicApiRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { city } = await params;
    const cityName = decodeURIComponent(city).replace(/-/g, " ");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const [aeds, total] = await Promise.all([
      prisma.aed.findMany({
        where: {
          publication_mode: { not: "NONE" },
          published_at: { not: null },
          location: {
            city_name: { equals: cityName, mode: "insensitive" },
          },
        },
        select: {
          id: true,
          name: true,
          establishment_type: true,
          latitude: true,
          longitude: true,
          publication_mode: true,
          location: {
            select: {
              street_type: true,
              street_name: true,
              street_number: true,
              postal_code: true,
              district_name: true,
              city_name: true,
              access_instructions: true,
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
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.aed.count({
        where: {
          publication_mode: { not: "NONE" },
          published_at: { not: null },
          location: {
            city_name: { equals: cityName, mode: "insensitive" },
          },
        },
      }),
    ]);

    if (aeds.length === 0 && offset === 0) {
      return NextResponse.json(
        {
          error: "not_found",
          message: `No AEDs found in city "${cityName}". Try a different city name.`,
          hint: "Use /api/v1/aeds/stats/cities to see available cities.",
        },
        { status: 404 }
      );
    }

    const actualCityName = aeds[0]?.location?.city_name || cityName;

    const data = aeds.map((aed) => ({
      id: aed.id,
      name: aed.name,
      establishment_type: aed.establishment_type || null,
      latitude: aed.latitude,
      longitude: aed.longitude,
      address: aed.location
        ? {
            street: [aed.location.street_type, aed.location.street_name, aed.location.street_number]
              .filter(Boolean)
              .join(" "),
            city: aed.location.city_name || null,
            district: aed.location.district_name || null,
            postal_code: aed.location.postal_code || null,
            access_instructions:
              aed.publication_mode !== "LOCATION_ONLY"
                ? aed.location.access_instructions || null
                : null,
          }
        : null,
      schedule:
        aed.publication_mode !== "LOCATION_ONLY" && aed.schedule
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
        city: actualCityName,
        total,
        limit,
        offset,
        has_more: offset + limit < total,
        api_version: "v1",
      },
    });

    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    response.headers.set("Access-Control-Allow-Origin", "*");

    return response;
  } catch (error) {
    console.error("[Public API v1] Error fetching city AEDs:", error);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
