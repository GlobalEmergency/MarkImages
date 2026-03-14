/**
 * ClusterCacheService - Pre-computes and stores map clusters.
 *
 * Runs a single heavy PostGIS query per zoom level to generate clusters,
 * stores them in aed_cluster_cache, and subsequent map API calls read
 * from this table (~10ms) instead of computing in real-time (~seconds).
 *
 * Should be called after imports, syncs, or on-demand from admin.
 */

import { prisma } from "@/lib/db";
import { getQueryStrategy } from "@/lib/zoom-strategy";

/** Zoom levels that use clustering (individual markers at zoom 16+ are always real-time) */
const CLUSTERED_ZOOM_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export interface RegenerationResult {
  success: boolean;
  totalClusters: number;
  totalAeds: number;
  durationMs: number;
  zoomLevels: number[];
  error?: string;
}

/**
 * Regenerate all pre-computed clusters.
 * Truncates old data and recomputes for all zoom levels.
 */
export async function regenerateClusterCache(): Promise<RegenerationResult> {
  const startTime = Date.now();

  try {
    // Count total published AEDs
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

    let totalClusters = 0;

    // Generate clusters for each zoom level
    for (const zoom of CLUSTERED_ZOOM_LEVELS) {
      const strategy = getQueryStrategy(zoom);

      if (!strategy.clusteringEnabled || strategy.clusterGridSize === null) {
        continue;
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
        zoom,
        strategy.clusterGridSize,
        strategy.minClusterSize
      );

      totalClusters += inserted;
    }

    const durationMs = Date.now() - startTime;

    // Record metadata
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO aed_cluster_cache_metadata
        (last_regenerated, total_aeds, total_clusters, duration_ms, zoom_levels)
      VALUES (now(), $1, $2, $3, $4)
      `,
      totalAeds,
      totalClusters,
      durationMs,
      CLUSTERED_ZOOM_LEVELS
    );

    return {
      success: true,
      totalClusters,
      totalAeds,
      durationMs,
      zoomLevels: CLUSTERED_ZOOM_LEVELS,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error("Error regenerating cluster cache:", error);
    return {
      success: false,
      totalClusters: 0,
      totalAeds: 0,
      durationMs,
      zoomLevels: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if the cluster cache has data.
 */
export async function isClusterCachePopulated(): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM aed_cluster_cache LIMIT 1`
  );
  return Number(result[0].count) > 0;
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
