/**
 * Infrastructure Adapter: PostGISClusteringAdapter
 *
 * Implementación concreta del puerto IClusteringService usando PostGIS.
 * Optimizado para datasets de millones de puntos usando índice espacial GiST.
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
   * Calcula clusters usando ST_SnapToGrid de PostGIS.
   * Optimizado: usa ST_Within + ST_MakeEnvelope para aprovechar el índice GiST,
   * y ejecuta una sola query combinada para clusters + individuales.
   */
  async calculateClusters(params: ClusteringParams): Promise<ClusteringResult> {
    const { bounds, gridSize, minClusterSize, limit } = params;

    // Query combinada: calcula clusters y marcadores individuales en una sola pasada.
    // Usa ST_Within + ST_MakeEnvelope para aprovechar el índice GiST en la columna geom.
    const combinedQuery = `
      WITH filtered AS (
        SELECT
          a.id,
          a.code,
          a.name,
          a.latitude,
          a.longitude,
          a.establishment_type,
          a.publication_mode,
          ST_SnapToGrid(a.geom, $5) AS grid_point
        FROM aeds a
        WHERE
          a.status = 'PUBLISHED'
          AND a.publication_mode != 'NONE'
          AND a.geom IS NOT NULL
          AND ST_Within(
            a.geom,
            ST_MakeEnvelope($3, $1, $4, $2, 4326)
          )
      ),
      grid_counts AS (
        SELECT
          grid_point,
          COUNT(*) AS cnt
        FROM filtered
        GROUP BY grid_point
      ),
      cluster_data AS (
        SELECT
          ST_Y(gc.grid_point) AS center_lat,
          ST_X(gc.grid_point) AS center_lng,
          gc.cnt AS count,
          MIN(f.latitude) AS min_lat,
          MAX(f.latitude) AS max_lat,
          MIN(f.longitude) AS min_lng,
          MAX(f.longitude) AS max_lng
        FROM grid_counts gc
        JOIN filtered f ON f.grid_point = gc.grid_point
        WHERE gc.cnt >= $6
        GROUP BY gc.grid_point, gc.cnt
        ORDER BY gc.cnt DESC
        LIMIT $7
      ),
      individual_data AS (
        SELECT
          f.id,
          f.code,
          f.name,
          f.latitude,
          f.longitude,
          f.establishment_type,
          f.publication_mode
        FROM filtered f
        JOIN grid_counts gc ON f.grid_point = gc.grid_point
        WHERE gc.cnt < $6
        LIMIT $7
      )
      SELECT
        'cluster' AS row_type,
        NULL AS id,
        NULL AS code,
        NULL AS name,
        center_lat AS latitude,
        center_lng AS longitude,
        NULL AS establishment_type,
        NULL AS publication_mode,
        count::int AS cluster_count,
        min_lat AS bounds_min_lat,
        max_lat AS bounds_max_lat,
        min_lng AS bounds_min_lng,
        max_lng AS bounds_max_lng
      FROM cluster_data

      UNION ALL

      SELECT
        'marker' AS row_type,
        id,
        code,
        name,
        latitude,
        longitude,
        establishment_type,
        publication_mode,
        NULL AS cluster_count,
        NULL AS bounds_min_lat,
        NULL AS bounds_max_lat,
        NULL AS bounds_min_lng,
        NULL AS bounds_max_lng
      FROM individual_data
    `;

    interface CombinedRow {
      row_type: string;
      id: string | null;
      code: string | null;
      name: string | null;
      latitude: number;
      longitude: number;
      establishment_type: string | null;
      publication_mode: string | null;
      cluster_count: number | null;
      bounds_min_lat: number | null;
      bounds_max_lat: number | null;
      bounds_min_lng: number | null;
      bounds_max_lng: number | null;
    }

    const results = await prisma.$queryRawUnsafe<CombinedRow[]>(
      combinedQuery,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      gridSize,
      minClusterSize,
      limit
    );

    const clusters: AedCluster[] = [];
    const markers: AedMapMarker[] = [];

    for (const row of results) {
      if (row.row_type === "cluster") {
        clusters.push({
          id: `cluster_${row.latitude.toFixed(4)}_${row.longitude.toFixed(4)}`,
          center: { lat: row.latitude, lng: row.longitude },
          count: row.cluster_count!,
          bounds: {
            minLat: row.bounds_min_lat!,
            maxLat: row.bounds_max_lat!,
            minLng: row.bounds_min_lng!,
            maxLng: row.bounds_max_lng!,
          },
        });
      } else {
        markers.push({
          id: row.id!,
          code: row.code!,
          name: row.name!,
          latitude: row.latitude,
          longitude: row.longitude,
          establishment_type: row.establishment_type!,
          publication_mode: row.publication_mode as AedMapMarker["publication_mode"],
        });
      }
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
    };
  }

  /**
   * Obtiene todos los DEAs individuales sin clustering.
   * Usa ST_Within + ST_MakeEnvelope para aprovechar el índice GiST.
   */
  async getIndividualMarkers(bounds: BoundingBox, limit: number): Promise<AedMapMarker[]> {
    const query = `
      SELECT
        a.id,
        a.code,
        a.name,
        a.latitude,
        a.longitude,
        a.establishment_type,
        a.publication_mode
      FROM aeds a
      WHERE
        a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.geom IS NOT NULL
        AND ST_Within(
          a.geom,
          ST_MakeEnvelope($3, $1, $4, $2, 4326)
        )
      LIMIT $5
    `;

    return await prisma.$queryRawUnsafe<AedMapMarker[]>(
      query,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      limit
    );
  }
}
