/**
 * ClusterCacheService - Pre-computes and stores map clusters.
 *
 * Supports chunked processing: each zoom level is processed independently
 * so each request stays under the Vercel 30s timeout.
 *
 * Flow:
 * 1. Client calls POST /api/admin/clusters with { action: "start" }
 * 2. Server clears cache, returns list of zoom levels to process
 * 3. Client calls POST /api/admin/clusters with { action: "process", zoomLevel: N } for each
 * 4. Each call processes one zoom level (~3-5s) and returns progress
 */

import { prisma } from "@/lib/db";
import { getQueryStrategy } from "@/lib/zoom-strategy";

/** Zoom levels that use clustering (individual markers at zoom 16+ are always real-time) */
const CLUSTERED_ZOOM_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export { CLUSTERED_ZOOM_LEVELS };

export interface RegenerationStartResult {
  zoomLevels: number[];
  totalAeds: number;
}

export interface ZoomLevelResult {
  zoomLevel: number;
  clustersGenerated: number;
  durationMs: number;
}

/**
 * Step 1: Clear cache and return zoom levels to process.
 */
export async function startRegeneration(): Promise<RegenerationStartResult> {
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT COUNT(*) as count
    FROM aeds
    WHERE status = 'PUBLISHED'
      AND publication_mode != 'NONE'
      AND geom IS NOT NULL
  `);
  const totalAeds = Number(countResult[0].count);

  // Clear existing cache
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE aed_cluster_cache`);

  return {
    zoomLevels: CLUSTERED_ZOOM_LEVELS,
    totalAeds,
  };
}

/**
 * Step 2: Process a single zoom level. Each call takes ~3-5s for 3M+ points.
 */
export async function processZoomLevel(zoomLevel: number): Promise<ZoomLevelResult> {
  const startTime = Date.now();

  const strategy = getQueryStrategy(zoomLevel);

  if (!strategy.clusteringEnabled || strategy.clusterGridSize === null) {
    return { zoomLevel, clustersGenerated: 0, durationMs: Date.now() - startTime };
  }

  const inserted = await prisma.$executeRawUnsafe(
    `
    INSERT INTO aed_cluster_cache
      (zoom_level, center_lat, center_lng, count,
       bounds_min_lat, bounds_max_lat, bounds_min_lng, bounds_max_lng, geom)
    SELECT
      $1::int AS zoom_level,
      ST_Y(grid_point) AS center_lat,
      ST_X(grid_point) AS center_lng,
      cnt,
      min_lat, max_lat, min_lng, max_lng,
      grid_point AS geom
    FROM (
      SELECT
        ST_SnapToGrid(a.geom, $2) AS grid_point,
        COUNT(*)::int AS cnt,
        MIN(a.latitude) AS min_lat,
        MAX(a.latitude) AS max_lat,
        MIN(a.longitude) AS min_lng,
        MAX(a.longitude) AS max_lng
      FROM aeds a
      WHERE
        a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.geom IS NOT NULL
      GROUP BY grid_point
      HAVING COUNT(*) >= $3
    ) AS clusters
    `,
    zoomLevel,
    strategy.clusterGridSize,
    strategy.minClusterSize
  );

  return {
    zoomLevel,
    clustersGenerated: inserted,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Step 3: Record final metadata after all zoom levels are processed.
 */
export async function finalizeRegeneration(
  totalAeds: number,
  totalClusters: number,
  totalDurationMs: number
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO aed_cluster_cache_metadata
      (last_regenerated, total_aeds, total_clusters, duration_ms, zoom_levels)
    VALUES (now(), $1, $2, $3, $4)
    `,
    totalAeds,
    totalClusters,
    totalDurationMs,
    CLUSTERED_ZOOM_LEVELS
  );
}

/**
 * Full regeneration in one call (for cron jobs where timeout is not an issue).
 */
export async function regenerateClusterCache() {
  const startTime = Date.now();

  try {
    const { totalAeds } = await startRegeneration();
    let totalClusters = 0;

    for (const zoom of CLUSTERED_ZOOM_LEVELS) {
      const result = await processZoomLevel(zoom);
      totalClusters += result.clustersGenerated;
    }

    const durationMs = Date.now() - startTime;
    await finalizeRegeneration(totalAeds, totalClusters, durationMs);

    return {
      success: true,
      totalClusters,
      totalAeds,
      durationMs,
      zoomLevels: CLUSTERED_ZOOM_LEVELS,
    };
  } catch (error) {
    console.error("Error regenerating cluster cache:", error);
    return {
      success: false,
      totalClusters: 0,
      totalAeds: 0,
      durationMs: Date.now() - startTime,
      zoomLevels: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the last regeneration metadata.
 */
export async function getClusterCacheMetadata() {
  const result = await prisma.$queryRawUnsafe<
    Array<{
      last_regenerated: Date;
      total_aeds: number;
      total_clusters: number;
      duration_ms: number;
    }>
  >(`
    SELECT last_regenerated, total_aeds, total_clusters, duration_ms
    FROM aed_cluster_cache_metadata
    ORDER BY id DESC
    LIMIT 1
  `);

  return result[0] ?? null;
}

/**
 * Get current cluster count in cache.
 */
export async function getClusterCacheStats() {
  const result = await prisma.$queryRawUnsafe<
    Array<{ zoom_level: number; cluster_count: bigint }>
  >(`
    SELECT zoom_level, COUNT(*) as cluster_count
    FROM aed_cluster_cache
    GROUP BY zoom_level
    ORDER BY zoom_level
  `);

  return result.map((r) => ({
    zoomLevel: r.zoom_level,
    clusterCount: Number(r.cluster_count),
  }));
}
