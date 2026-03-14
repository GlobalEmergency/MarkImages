/**
 * Infrastructure Adapter: PostGISClusteringAdapter
 *
 * Reads clusters from the pre-computed aed_cluster_cache table (~10ms).
 * Falls back to real-time computation if cache is empty.
 * Individual markers at high zoom levels are always fetched in real-time.
 */

import { prisma } from "@/lib/db";
import type { AedCluster, AedMapMarker, BoundingBox } from "@/types/aed";
import type {
  ClusteringParams,
  ClusteringResult,
  IClusteringService,
} from "@/clustering/domain/ports/IClusteringService";

export class PostGISClusteringAdapter implements IClusteringService {
  /**
   * Returns clusters from pre-computed cache + individual markers in real-time.
   * The cache lookup is a simple SELECT with spatial index (~10ms for any zoom).
   * Individual markers (those below minClusterSize) are still fetched in real-time,
   * but filtered by the bounding box which is fast with the GiST index.
   */
  async calculateClusters(params: ClusteringParams): Promise<ClusteringResult> {
    const { bounds, gridSize, minClusterSize, limit } = params;

    // Determine the zoom level from the grid size for cache lookup
    const zoomLevel = this.gridSizeToZoom(gridSize);

    // 1. Try to get clusters from pre-computed cache
    const cachedClusters = await this.getCachedClusters(zoomLevel, bounds, limit);

    let clusters: AedCluster[];
    let usedCache: boolean;

    if (cachedClusters.length > 0) {
      clusters = cachedClusters;
      usedCache = true;
    } else {
      // Fallback: compute clusters in real-time (cache not populated yet)
      clusters = await this.computeClustersRealTime(bounds, gridSize, minClusterSize, limit);
      usedCache = false;
    }

    // 2. Get individual markers (not in clusters) — always real-time
    // These are AEDs in grid cells with fewer than minClusterSize points
    const markers = usedCache
      ? await this.getIndividualMarkersExcludingClusters(bounds, gridSize, minClusterSize, limit)
      : await this.getIndividualMarkersRealTime(bounds, gridSize, minClusterSize, limit);

    const totalClustered = clusters.reduce((sum, c) => sum + c.count, 0);

    return {
      clusters,
      markers,
      stats: {
        total_in_view: totalClustered + markers.length,
        clustered: totalClustered,
        individual: markers.length,
      },
    };
  }

  /**
   * Get clusters from the pre-computed cache table.
   * Uses ST_Within for GiST index on the cache table.
   */
  private async getCachedClusters(
    zoomLevel: number,
    bounds: BoundingBox,
    limit: number
  ): Promise<AedCluster[]> {
    const results = await prisma.$queryRawUnsafe<
      Array<{
        center_lat: number;
        center_lng: number;
        count: number;
        bounds_min_lat: number;
        bounds_max_lat: number;
        bounds_min_lng: number;
        bounds_max_lng: number;
      }>
    >(
      `
      SELECT center_lat, center_lng, count,
             bounds_min_lat, bounds_max_lat, bounds_min_lng, bounds_max_lng
      FROM aed_cluster_cache
      WHERE zoom_level = $1
        AND geom IS NOT NULL
        AND ST_Within(
          geom,
          ST_MakeEnvelope($3, $2, $4, $5, 4326)
        )
      ORDER BY count DESC
      LIMIT $6
      `,
      zoomLevel,
      bounds.minLat,
      bounds.minLng,
      bounds.maxLng,
      bounds.maxLat,
      limit
    );

    return results.map((row) => ({
      id: `cluster_${row.center_lat.toFixed(4)}_${row.center_lng.toFixed(4)}`,
      center: { lat: row.center_lat, lng: row.center_lng },
      count: row.count,
      bounds: {
        minLat: row.bounds_min_lat,
        maxLat: row.bounds_max_lat,
        minLng: row.bounds_min_lng,
        maxLng: row.bounds_max_lng,
      },
    }));
  }

  /**
   * Fallback: compute clusters in real-time when cache is empty.
   */
  private async computeClustersRealTime(
    bounds: BoundingBox,
    gridSize: number,
    minClusterSize: number,
    limit: number
  ): Promise<AedCluster[]> {
    const results = await prisma.$queryRawUnsafe<
      Array<{
        center_lat: number;
        center_lng: number;
        count: bigint;
        min_lat: number;
        max_lat: number;
        min_lng: number;
        max_lng: number;
      }>
    >(
      `
      SELECT
        ST_Y(grid_point) AS center_lat,
        ST_X(grid_point) AS center_lng,
        cnt AS count,
        min_lat, max_lat, min_lng, max_lng
      FROM (
        SELECT
          ST_SnapToGrid(a.geom, $5) AS grid_point,
          COUNT(*) AS cnt,
          MIN(a.latitude) AS min_lat,
          MAX(a.latitude) AS max_lat,
          MIN(a.longitude) AS min_lng,
          MAX(a.longitude) AS max_lng
        FROM aeds a
        WHERE
          a.status = 'PUBLISHED'
          AND a.publication_mode != 'NONE'
          AND a.geom IS NOT NULL
          AND ST_Within(a.geom, ST_MakeEnvelope($3, $1, $4, $2, 4326))
        GROUP BY grid_point
        HAVING COUNT(*) >= $6
      ) sub
      ORDER BY cnt DESC
      LIMIT $7
      `,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      gridSize,
      minClusterSize,
      limit
    );

    return results.map((row) => ({
      id: `cluster_${row.center_lat.toFixed(4)}_${row.center_lng.toFixed(4)}`,
      center: { lat: row.center_lat, lng: row.center_lng },
      count: Number(row.count),
      bounds: {
        minLat: row.min_lat,
        maxLat: row.max_lat,
        minLng: row.min_lng,
        maxLng: row.max_lng,
      },
    }));
  }

  /**
   * Get individual markers that are NOT part of any cached cluster.
   * Uses a simple bounding box query since these are few markers.
   */
  private async getIndividualMarkersExcludingClusters(
    bounds: BoundingBox,
    gridSize: number,
    minClusterSize: number,
    limit: number
  ): Promise<AedMapMarker[]> {
    return await prisma.$queryRawUnsafe<AedMapMarker[]>(
      `
      SELECT a.id, a.code, a.name, a.latitude, a.longitude,
             a.establishment_type, a.publication_mode
      FROM aeds a
      WHERE
        a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.geom IS NOT NULL
        AND ST_Within(a.geom, ST_MakeEnvelope($3, $1, $4, $2, 4326))
        AND ST_SnapToGrid(a.geom, $5) IN (
          SELECT ST_SnapToGrid(b.geom, $5)
          FROM aeds b
          WHERE b.status = 'PUBLISHED'
            AND b.publication_mode != 'NONE'
            AND b.geom IS NOT NULL
            AND ST_Within(b.geom, ST_MakeEnvelope($3, $1, $4, $2, 4326))
          GROUP BY ST_SnapToGrid(b.geom, $5)
          HAVING COUNT(*) < $6
        )
      LIMIT $7
      `,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      gridSize,
      minClusterSize,
      limit
    );
  }

  /**
   * Fallback individual markers when using real-time clusters.
   */
  private async getIndividualMarkersRealTime(
    bounds: BoundingBox,
    gridSize: number,
    minClusterSize: number,
    limit: number
  ): Promise<AedMapMarker[]> {
    return this.getIndividualMarkersExcludingClusters(bounds, gridSize, minClusterSize, limit);
  }

  /**
   * Get all individual markers without clustering (high zoom levels).
   */
  async getIndividualMarkers(bounds: BoundingBox, limit: number): Promise<AedMapMarker[]> {
    return await prisma.$queryRawUnsafe<AedMapMarker[]>(
      `
      SELECT a.id, a.code, a.name, a.latitude, a.longitude,
             a.establishment_type, a.publication_mode
      FROM aeds a
      WHERE
        a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.geom IS NOT NULL
        AND ST_Within(a.geom, ST_MakeEnvelope($3, $1, $4, $2, 4326))
      LIMIT $5
      `,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      limit
    );
  }

  /**
   * Map grid size back to zoom level for cache lookup.
   */
  private gridSizeToZoom(gridSize: number): number {
    // Must match zoom-strategy.ts grid sizes
    if (gridSize >= 5) return 2;
    if (gridSize >= 2) return 6;
    if (gridSize >= 0.5) return 8;
    if (gridSize >= 0.2) return 10;
    if (gridSize >= 0.1) return 11;
    if (gridSize >= 0.05) return 12;
    if (gridSize >= 0.02) return 13;
    if (gridSize >= 0.01) return 14;
    if (gridSize >= 0.005) return 15;
    return 16;
  }
}
