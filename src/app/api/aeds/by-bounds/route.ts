/**
 * API Route: /api/aeds/by-bounds
 *
 * Geospatial API to fetch AEDs within a bounding box
 * Optimized for map visualization with large datasets
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getQueryStrategy, isValidBoundingBox, getStrategyDescription } from "@/lib/zoom-strategy";
import type { AedsByBoundsResponse } from "@/types/aed";

/**
 * GET /api/aeds/by-bounds
 * Fetch AEDs within a geographic bounding box
 *
 * Query params:
 * - minLat: minimum latitude (required)
 * - maxLat: maximum latitude (required)
 * - minLng: minimum longitude (required)
 * - maxLng: maximum longitude (required)
 * - zoom: map zoom level 0-20 (optional, default: 12)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate parameters
    const minLat = parseFloat(searchParams.get("minLat") || "");
    const maxLat = parseFloat(searchParams.get("maxLat") || "");
    const minLng = parseFloat(searchParams.get("minLng") || "");
    const maxLng = parseFloat(searchParams.get("maxLng") || "");
    const zoom = parseInt(searchParams.get("zoom") || "12", 10);

    // Validate coordinates
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLng) || isNaN(maxLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          message:
            "All bounding box coordinates (minLat, maxLat, minLng, maxLng) are required and must be valid numbers",
        },
        { status: 400 }
      );
    }

    // Validate bounding box
    if (!isValidBoundingBox(minLat, maxLat, minLng, maxLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid bounding box",
          message: "Bounding box coordinates are invalid or out of range",
        },
        { status: 400 }
      );
    }

    // Get query strategy based on zoom level
    const strategy = getQueryStrategy(zoom);

    // Build the query
    let query = `
      SELECT 
        a.id,
        a.code,
        a.name,
        a.latitude,
        a.longitude,
        a.establishment_type
      FROM aeds a
      WHERE 
        a.status = 'PUBLISHED'
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
        AND a.latitude BETWEEN $1 AND $2
        AND a.longitude BETWEEN $3 AND $4
    `;

    // Apply sampling if needed (for low zoom levels)
    if (strategy.sampling) {
      // Use ST_SnapToGrid for consistent spatial sampling
      const gridSize = parseFloat(strategy.sampling.replace("grid_", ""));
      query += `
        AND ST_Within(
          a.geom,
          (SELECT ST_Union(
            ST_SnapToGrid(a2.geom, ${gridSize})
          ) FROM aeds a2
          WHERE a2.status = 'PUBLISHED'
            AND a2.latitude BETWEEN $1 AND $2
            AND a2.longitude BETWEEN $3 AND $4
          )
        )
      `;
    }

    // Add ordering
    query += ` ORDER BY a.${strategy.orderBy} DESC`;

    // Add limit
    query += ` LIMIT $5`;

    // Execute query
    const aeds = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        code: string;
        name: string;
        latitude: number;
        longitude: number;
        establishment_type: string;
      }>
    >(
      query,
      minLat,
      maxLat,
      minLng,
      maxLng,
      strategy.limit + 1 // Fetch one extra to know if truncated
    );

    // Check if results were truncated
    const truncated = aeds.length > strategy.limit;
    const data = truncated ? aeds.slice(0, strategy.limit) : aeds;

    const response: AedsByBoundsResponse = {
      success: true,
      data,
      count: data.length,
      truncated,
      zoom_level: zoom,
      strategy: getStrategyDescription(strategy),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching AEDs by bounds:", error);
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
