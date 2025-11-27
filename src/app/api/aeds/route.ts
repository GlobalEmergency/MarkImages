/**
 * API Route: /api/aeds
 *
 * API to list and create AEDs (Automated External Defibrillators)
 */

import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

/**
 * Types for creating a new AED
 */
interface CreateAedRequest {
  // Basic AED data (required)
  code: string;
  name: string;
  establishment_type: string;
  latitude: number;
  longitude: number;

  // Optional AED data
  provisional_number?: number;
  source_details?: string;
  origin_observations?: string;

  // Location data (required)
  location: {
    street_type: string;
    street_name: string;
    street_number?: string;
    additional_info?: string;
    postal_code: string;
    district_id: string;
    neighborhood_id?: string;
    access_description?: string;
    visible_references?: string;
    floor?: string;
    specific_location?: string;
    location_observations?: string;
    access_warnings?: string;
  };

  // Responsible data (required)
  responsible: {
    name: string;
    email: string;
    phone?: string;
    alternative_phone?: string;
    ownership: string;
    local_ownership: string;
    local_use: string;
    organization?: string;
    position?: string;
    department?: string;
    observations?: string;
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
    observations?: string;
    schedule_exceptions?: string;
    access_instructions?: string;
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
          location: {
            select: {
              street_type: true,
              street_name: true,
              street_number: true,
              postal_code: true,
              access_description: true,
              district: {
                select: {
                  name: true,
                },
              },
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
              order: 'asc',
            },
            take: 5,
          },
        },
        orderBy: {
          created_at: "desc",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: aeds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
    const body: CreateAedRequest = await request.json();

    // Validate required fields
    if (!body.code || !body.name || !body.establishment_type) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required AED fields",
          message: "code, name, and establishment_type are required",
        },
        { status: 400 }
      );
    }

    if (!body.latitude || !body.longitude) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required coordinates",
          message: "latitude and longitude are required",
        },
        { status: 400 }
      );
    }

    if (!body.location) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing location data",
          message: "location is required",
        },
        { status: 400 }
      );
    }

    if (!body.responsible) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing responsible data",
          message: "responsible is required",
        },
        { status: 400 }
      );
    }

    // Validate responsible required fields
    if (!body.responsible.name || !body.responsible.email || !body.responsible.ownership || !body.responsible.local_ownership || !body.responsible.local_use) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required responsible fields",
          message: "name, email, ownership, local_ownership, and local_use are required for responsible",
        },
        { status: 400 }
      );
    }

    // Validate location required fields
    if (!body.location.street_type || !body.location.street_name || !body.location.postal_code || !body.location.district_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required location fields",
          message: "street_type, street_name, postal_code, and district_id are required for location",
        },
        { status: 400 }
      );
    }

    // Check if code already exists
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

    // Check if email already exists for responsible
    const existingResponsible = await prisma.aedResponsible.findUnique({
      where: { email: body.responsible.email },
    });

    let responsibleId: string;

    if (existingResponsible) {
      // Reuse existing responsible
      responsibleId = existingResponsible.id;
    } else {
      // Create new responsible
      const newResponsible = await prisma.aedResponsible.create({
        data: {
          name: body.responsible.name,
          email: body.responsible.email,
          phone: body.responsible.phone,
          alternative_phone: body.responsible.alternative_phone,
          ownership: body.responsible.ownership,
          local_ownership: body.responsible.local_ownership,
          local_use: body.responsible.local_use,
          organization: body.responsible.organization,
          position: body.responsible.position,
          department: body.responsible.department,
          observations: body.responsible.observations,
        },
      });
      responsibleId = newResponsible.id;
    }

    // Create location
    const location = await prisma.aedLocation.create({
      data: {
        street_type: body.location.street_type,
        street_name: body.location.street_name,
        street_number: body.location.street_number,
        additional_info: body.location.additional_info,
        postal_code: body.location.postal_code,
        latitude: body.latitude,
        longitude: body.longitude,
        coordinates_precision: "medium",
        district_id: body.location.district_id,
        neighborhood_id: body.location.neighborhood_id,
        access_description: body.location.access_description,
        visible_references: body.location.visible_references,
        floor: body.location.floor,
        specific_location: body.location.specific_location,
        location_observations: body.location.location_observations,
        access_warnings: body.location.access_warnings,
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
          observations: body.schedule.observations,
          schedule_exceptions: body.schedule.schedule_exceptions,
          access_instructions: body.schedule.access_instructions,
        },
      });
      scheduleId = schedule.id;
    }

    // Create AED with PENDING_REVIEW status
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
        origin_observations: body.origin_observations,
        status: "PENDING_REVIEW",
        location_id: location.id,
        responsible_id: responsibleId,
        schedule_id: scheduleId,
        coordinates_precision: "medium",
      },
      include: {
        location: {
          include: {
            district: true,
            neighborhood: true,
          },
        },
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
