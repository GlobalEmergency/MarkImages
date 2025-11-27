/**
 * API Route: /api/aeds
 *
 * Simple API to list published AEDs (Automated External Defibrillators)
 */

import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

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
