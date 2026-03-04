/**
 * API Route: /api/aeds
 *
 * API to list and create AEDs (Automated External Defibrillators)
 */

import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";

/** Rate limiter for anonymous AED creation: 5 requests per hour per IP */
const aedCreateRateLimiter = createRateLimiter("aed-create-anon", {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
});

/**
 * Types for creating a new AED
 */
interface CreateAedRequest {
  // Basic AED data
  code?: string;
  name: string;
  establishment_type?: string;
  latitude?: number;
  longitude?: number;

  // Optional AED data
  provisional_number?: number;
  source_details?: string;
  internal_notes?: string;

  // Location data (optional)
  location?: {
    street_type?: string;
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    district_id?: number;
    neighborhood_id?: number;
    floor?: string;
    location_details?: string;
    access_instructions?: string;
  };

  // Responsible data (optional)
  responsible?: {
    name?: string;
    email?: string;
    phone?: string;
    alternative_phone?: string;
    ownership?: string;
    local_ownership?: string;
    local_use?: string;
    organization?: string;
    position?: string;
    department?: string;
    notes?: string;
  };

  // Schedule data (optional)
  schedule?: {
    description?: string;
    has_24h_surveillance?: boolean;
    has_restricted_access?: boolean;
    weekday_opening?: string;
    weekday_closing?: string;
    saturday_opening?: string;
    saturday_closing?: string;
    sunday_opening?: string;
    sunday_closing?: string;
    holidays_as_weekday?: boolean;
    closed_on_holidays?: boolean;
    closed_in_august?: boolean;
    notes?: string;
  };
}

/**
 * GET /api/aeds
 * List all published AEDs with pagination
 *
 * Query params:
 * - page: page number (default: 1)
 * - limit: records per page (default: 50, max: 100)
 * - search: search by name or code (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const search = searchParams.get("search") || "";

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      status: "PUBLISHED" as const,
      publication_mode: {
        not: "NONE" as const,
      },
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { code: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Get total count and records in parallel
    const [total, aeds] = await Promise.all([
      prisma.aed.count({ where }),
      prisma.aed.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: {
          created_at: "desc",
        },
      }),
    ]);

    // Filter each AED based on its publication_mode
    const filteredAeds = aeds
      .map((aed) => filterAedByPublicationMode(aed as AedFullData))
      .filter((aed): aed is NonNullable<typeof aed> => aed !== null);

    const response = NextResponse.json({
      success: true,
      data: filteredAeds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

    // Cache public AED list for 60s, allow stale for 5min while revalidating
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

    return response;
  } catch (error) {
    console.error("Error fetching AEDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AEDs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/aeds
 * Create a new AED in PENDING_REVIEW status
 *
 * Body: CreateAedRequest (see interface above)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit anonymous requests (authenticated users bypass)
    const user = await getUserFromRequest(request);
    if (!user) {
      const rateLimitResponse = aedCreateRateLimiter(request);
      if (rateLimitResponse) return rateLimitResponse;
    }

    const body: CreateAedRequest = await request.json();

    // Validate required fields and basic sanitization
    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.length > 500
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field",
          message: "name is required",
        },
        { status: 400 }
      );
    }

    // Check if code already exists (only if code is provided)
    if (body.code) {
      const existingAed = await prisma.aed.findUnique({
        where: { code: body.code },
      });

      if (existingAed) {
        return NextResponse.json(
          {
            success: false,
            error: "Code already exists",
            message: `An AED with code ${body.code} already exists`,
          },
          { status: 409 }
        );
      }
    }

    // Create responsible only if data is provided
    let responsibleId: string | undefined;
    if (body.responsible && body.responsible.name) {
      const newResponsible = await prisma.aedResponsible.create({
        data: {
          name: body.responsible.name || "",
          email: body.responsible.email,
          phone: body.responsible.phone,
          alternative_phone: body.responsible.alternative_phone,
          ownership: body.responsible.ownership,
          local_ownership: body.responsible.local_ownership,
          local_use: body.responsible.local_use,
          organization: body.responsible.organization,
          position: body.responsible.position,
          department: body.responsible.department,
          notes: body.responsible.notes
            ? [{ text: body.responsible.notes, date: new Date().toISOString(), type: "creation" }]
            : undefined,
        },
      });
      responsibleId = newResponsible.id;
    }

    // Create location (optional fields)
    const location = await prisma.aedLocation.create({
      data: {
        street_type: body.location?.street_type,
        street_name: body.location?.street_name,
        street_number: body.location?.street_number,
        postal_code: body.location?.postal_code,
        floor: body.location?.floor,
        location_details: body.location?.location_details,
        access_instructions: body.location?.access_instructions,
      },
    });

    // Create schedule if provided
    let scheduleId: string | undefined;
    if (body.schedule) {
      const schedule = await prisma.aedSchedule.create({
        data: {
          description: body.schedule.description,
          has_24h_surveillance: body.schedule.has_24h_surveillance ?? false,
          has_restricted_access: body.schedule.has_restricted_access ?? false,
          weekday_opening: body.schedule.weekday_opening,
          weekday_closing: body.schedule.weekday_closing,
          saturday_opening: body.schedule.saturday_opening,
          saturday_closing: body.schedule.saturday_closing,
          sunday_opening: body.schedule.sunday_opening,
          sunday_closing: body.schedule.sunday_closing,
          holidays_as_weekday: body.schedule.holidays_as_weekday ?? false,
          closed_on_holidays: body.schedule.closed_on_holidays ?? false,
          closed_in_august: body.schedule.closed_in_august ?? false,
          notes: body.schedule.notes,
        },
      });
      scheduleId = schedule.id;
    }

    // Create AED with PENDING_REVIEW status and LOCATION_ONLY publication mode by default
    const aed = await prisma.aed.create({
      data: {
        code: body.code,
        name: body.name,
        establishment_type: body.establishment_type,
        latitude: body.latitude,
        longitude: body.longitude,
        provisional_number: body.provisional_number,
        source_origin: "WEB_FORM",
        source_details: body.source_details,
        internal_notes: body.internal_notes
          ? [{ text: body.internal_notes, date: new Date().toISOString(), type: "creation" }]
          : undefined,
        status: "PENDING_REVIEW",
        publication_mode: "LOCATION_ONLY",
        location_id: location.id,
        responsible_id: responsibleId,
        schedule_id: scheduleId,
        coordinates_precision: body.latitude && body.longitude ? "medium" : undefined,
      },
      include: {
        location: true,
        responsible: true,
        schedule: true,
      },
    });

    // Create status change record
    await prisma.aedStatusChange.create({
      data: {
        aed_id: aed.id,
        previous_status: null,
        new_status: "PENDING_REVIEW",
        reason: "New AED created via web form",
        notes: "Awaiting validation of address, images, and other data",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: aed,
        message: "AED created successfully and is now pending review",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating AED:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create AED",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
