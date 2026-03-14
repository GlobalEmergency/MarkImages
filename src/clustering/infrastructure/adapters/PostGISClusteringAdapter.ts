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
    const totalStart = Date.now();

    // Determine the zoom level from the grid size for cache lookup
    const zoomLevel = this.gridSizeToZoom(gridSize);

    // Run both queries in parallel to avoid paying connection overhead twice
    // (each Prisma $queryRawUnsafe has ~80ms connection acquisition overhead)
    const clusterStart = Date.now();
    const [cachedClusters, cachedMarkers] = await Promise.all([
      this.getCachedClusters(zoomLevel, bounds, limit),
      this.getIndividualMarkersFromCache(zoomLevel, bounds, gridSize, limit),
    ]);
    const parallelMs = Date.now() - clusterStart;

    const cacheUsed = cachedClusters.length > 0;

    let clusters: AedCluster[];
    let markers: AedMapMarker[];

    if (cacheUsed) {
      clusters = cachedClusters;
      markers = cachedMarkers;
    } else {
      // Fallback: compute everything in real-time (cache not populated yet)
      const [rtClusters, rtMarkers] = await Promise.all([
        this.computeClustersRealTime(bounds, gridSize, minClusterSize, limit),
        this.getIndividualMarkersRealTime(bounds, gridSize, minClusterSize, limit),
      ]);
      clusters = rtClusters;
      markers = rtMarkers;
    }

    const totalClustered = clusters.reduce((sum, c) => sum + c.count, 0);

    return {
      clusters,
      markers,
      stats: {
        total_in_view: totalClustered + markers.length,
        clustered: totalClustered,
        individual: markers.length,
      },
      timing: {
        clusters_ms: parallelMs,
        markers_ms: parallelMs,
        total_ms: Date.now() - totalStart,
        cache_used: cacheUsed,
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
   * Get individual markers using the cache table for exclusion.
   * Instead of recomputing ST_SnapToGrid + GROUP BY on all aeds (expensive),
   * we anti-join against the small cache table: exclude AEDs whose grid cell
   * matches a cached cluster. This turns an 800ms query into ~10-20ms.
   */
  private async getIndividualMarkersFromCache(
    zoomLevel: number,
    bounds: BoundingBox,
    gridSize: number,
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
        AND NOT EXISTS (
          SELECT 1 FROM aed_cluster_cache c
          WHERE c.zoom_level = $5
            AND c.geom = ST_SnapToGrid(a.geom, $6)
        )
      LIMIT $7
      `,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      zoomLevel,
      gridSize,
      limit
    );
  }

  /**
   * Fallback individual markers when cache is empty (real-time computation).
   */
  private async getIndividualMarkersRealTime(
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
