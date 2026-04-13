/**
 * Public API v1: GET /api/v1/aeds/stats
 *
 * Get general statistics about available AEDs.
 * Rate limited to 60 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";

import { PUBLISHED_AED_WHERE } from "@/lib/aed-status";
import { prisma } from "@/lib/db";
import { publicApiRateLimiter } from "@/lib/rate-limit-public-api";

interface CityCount {
  city_name: string;
  count: number;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = publicApiRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const [totalAeds, totalCitiesResult, topCities] = await Promise.all([
      prisma.aed.count({
        where: PUBLISHED_AED_WHERE,
      }),
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(DISTINCT l.city_name)::int as count
        FROM aeds a
        JOIN aed_locations l ON l.id = a.location_id
        WHERE a.status = 'PUBLISHED'
          AND a.publication_mode != 'NONE'
          AND l.city_name IS NOT NULL
          AND l.city_name != ''
      `,
      prisma.$queryRaw<CityCount[]>`
        SELECT l.city_name, COUNT(*)::int as count
        FROM aeds a
        JOIN aed_locations l ON l.id = a.location_id
        WHERE a.status = 'PUBLISHED'
          AND a.publication_mode != 'NONE'
          AND l.city_name IS NOT NULL
          AND l.city_name != ''
        GROUP BY l.city_name
        ORDER BY count DESC
        LIMIT 50
      `,
    ]);

    const response = NextResponse.json({
      data: {
        total_aeds: totalAeds,
        total_cities: totalCitiesResult[0]?.count ?? 0,
        top_cities: topCities.map((c) => ({
          name: c.city_name,
          count: c.count,
        })),
      },
      meta: { api_version: "v1" },
    });

    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    response.headers.set("Access-Control-Allow-Origin", "*");

    return response;
  } catch (error) {
    console.error("[Public API v1] Error fetching stats:", error);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
