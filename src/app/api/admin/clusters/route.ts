/**
 * API Route: /api/admin/clusters
 *
 * Admin endpoint to manage pre-computed cluster cache.
 *
 * GET: Get cache metadata + per-zoom stats
 * POST: Chunked regeneration (each call processes one zoom level, ~3-5s)
 *   - { action: "start" } → Clears cache, returns zoom levels to process
 *   - { action: "process", zoomLevel: N } → Processes one zoom level
 *   - { action: "finalize", totalAeds, totalClusters, totalDurationMs } → Records metadata
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import {
  startRegeneration,
  processZoomLevel,
  finalizeRegeneration,
  getClusterCacheMetadata,
  getClusterCacheStats,
} from "@/clustering/infrastructure/services/ClusterCacheService";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { action } = body;

    if (action === "start") {
      const result = await startRegeneration();
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "process") {
      const { zoomLevel } = body;
      if (typeof zoomLevel !== "number" || zoomLevel < 0 || zoomLevel > 20) {
        return NextResponse.json({ success: false, error: "Invalid zoomLevel" }, { status: 400 });
      }
      const result = await processZoomLevel(zoomLevel);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "finalize") {
      const { totalAeds, totalClusters, totalDurationMs } = body;
      await finalizeRegeneration(totalAeds, totalClusters, totalDurationMs);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use: start, process, finalize" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AuthError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as { statusCode?: number }).statusCode || 401 }
      );
    }
    console.error("Error in cluster cache API:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [metadata, stats] = await Promise.all([
      getClusterCacheMetadata(),
      getClusterCacheStats(),
    ]);

    const totalClusters = stats.reduce((sum, s) => sum + s.clusterCount, 0);

    return NextResponse.json({
      success: true,
      data: {
        metadata,
        stats,
        totalClusters,
        isEmpty: totalClusters === 0,
      },
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
