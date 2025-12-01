/**
 * API Route: /api/districts
 *
 * Simple API to list all districts
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * GET /api/districts
 * List all districts
 */
export async function GET() {
  try {
    const districts = await prisma.district.findMany({
      select: {
        id: true,
        district_code: true,
        name: true,
      },
      orderBy: {
        district_code: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: districts,
    });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch districts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
