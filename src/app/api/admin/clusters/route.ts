/**
 * API Route: /api/admin/clusters
 *
 * Admin endpoint to manage pre-computed cluster cache.
 * POST: Regenerate cluster cache
 * GET: Get cache metadata (last regeneration info)
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import {
  regenerateClusterCache,
  getClusterCacheMetadata,
} from "@/clustering/infrastructure/services/ClusterCacheService";

/**
 * POST /api/admin/clusters
 * Regenerate the pre-computed cluster cache.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const result = await regenerateClusterCache();

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalClusters: result.totalClusters,
        totalAeds: result.totalAeds,
        durationMs: result.durationMs,
        zoomLevels: result.zoomLevels,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AuthError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as { statusCode?: number }).statusCode || 401 }
      );
    }
    console.error("Error regenerating clusters:", error);
    return NextResponse.json(
      { success: false, error: "Failed to regenerate clusters" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/clusters
 * Get cluster cache metadata.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const metadata = await getClusterCacheMetadata();

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AuthError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as { statusCode?: number }).statusCode || 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to get cluster metadata" },
      { status: 500 }
    );
  }
}
