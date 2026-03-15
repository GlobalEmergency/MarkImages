/**
 * Public API v1: GET /api/v1/aeds/:id
 *
 * Get a single AED by ID with public data filtered by publication_mode.
 * Rate limited to 60 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";
import { publicApiRateLimiter } from "@/lib/rate-limit-public-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitResponse = publicApiRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;

    const aed = await prisma.aed.findUnique({
      where: { id },
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
            saturday_opening: true,
            saturday_closing: true,
            sunday_opening: true,
            sunday_closing: true,
          },
        },
        images: {
          select: {
            type: true,
            processed_url: true,
            thumbnail_url: true,
          },
          where: { is_verified: true },
          orderBy: { order: "asc" },
          take: 5,
        },
      },
    });

    if (!aed) {
      return NextResponse.json({ error: "not_found", message: "AED not found." }, { status: 404 });
    }

    const filtered = filterAedByPublicationMode(aed as AedFullData);

    if (!filtered) {
      return NextResponse.json(
        { error: "not_available", message: "This AED is not publicly available." },
        { status: 403 }
      );
    }

    const data = {
      id: filtered.id,
      name: filtered.name,
      establishment_type: filtered.establishment_type || null,
      latitude: filtered.latitude,
      longitude: filtered.longitude,
      address: filtered.location
        ? {
            street: [
              filtered.location.street_type,
              filtered.location.street_name,
              filtered.location.street_number,
            ]
              .filter(Boolean)
              .join(" "),
            city: filtered.location.city_name || null,
            district: filtered.location.district_name || null,
            postal_code: filtered.location.postal_code || null,
            access_instructions: filtered.location.access_instructions || null,
          }
        : null,
      schedule: filtered.schedule
        ? {
            is_24h: filtered.schedule.has_24h_surveillance,
            weekday_opening: filtered.schedule.weekday_opening,
            weekday_closing: filtered.schedule.weekday_closing,
            saturday_opening: filtered.schedule.saturday_opening || null,
            saturday_closing: filtered.schedule.saturday_closing || null,
            sunday_opening: filtered.schedule.sunday_opening || null,
            sunday_closing: filtered.schedule.sunday_closing || null,
          }
        : null,
      images:
        (aed.publication_mode === "FULL" &&
          aed.images?.map((img) => ({
            type: img.type,
            url: img.processed_url || img.thumbnail_url,
          }))) ||
        [],
      web_url: `https://deamap.es/dea/${filtered.id}`,
    };

    const response = NextResponse.json({
      data,
      meta: { api_version: "v1" },
    });

    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    response.headers.set("Access-Control-Allow-Origin", "*");

    return response;
  } catch (error) {
    console.error("[Public API v1] Error fetching AED:", error);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
