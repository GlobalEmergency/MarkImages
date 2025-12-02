/**
 * Infrastructure Adapter: PostGISClusteringAdapter
 *
 * Implementación concreta del puerto IClusteringService usando PostGIS.
 * Siguiendo SOLID:
 * - Single Responsibility: Solo se encarga de clustering con PostGIS
 * - Dependency Inversion: Implementa la interfaz del dominio
 * - Open/Closed: Extensible sin modificar el dominio
 */

import { prisma } from "@/lib/db";
import type { AedCluster, AedMapMarker, BoundingBox } from "@/types/aed";
import type {
  ClusteringParams,
  ClusteringResult,
  IClusteringService,
} from "@/domain/clustering/ports/IClusteringService";

export class PostGISClusteringAdapter implements IClusteringService {
  /**
   * Calcula clusters usando ST_SnapToGrid de PostGIS
   * Agrupa DEAs en una cuadrícula geográfica
   */
  async calculateClusters(params: ClusteringParams): Promise<ClusteringResult> {
    const { bounds, gridSize, minClusterSize, limit } = params;

    // Query para calcular clusters usando PostGIS
    const clustersQuery = `
      WITH grid_clusters AS (
        SELECT 
          ST_SnapToGrid(
            ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326),
            $5
          ) as cluster_point,
          COUNT(*) as count,
          MIN(a.latitude) as min_lat,
          MAX(a.latitude) as max_lat,
          MIN(a.longitude) as min_lng,
          MAX(a.longitude) as max_lng,
          array_agg(a.id) as aed_ids
        FROM aeds a
        WHERE 
          a.status = 'PUBLISHED'
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
          AND a.latitude BETWEEN $1 AND $2
          AND a.longitude BETWEEN $3 AND $4
        GROUP BY cluster_point
        HAVING COUNT(*) >= $6
      )
      SELECT 
        ST_Y(cluster_point) as center_lat,
        ST_X(cluster_point) as center_lng,
        count,
        min_lat,
        max_lat,
        min_lng,
        max_lng
      FROM grid_clusters
      ORDER BY count DESC
      LIMIT $7
    `;

    const clusterResults = await prisma.$queryRawUnsafe<
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
      clustersQuery,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      gridSize,
      minClusterSize,
      limit
    );

    // Transformar resultados a clusters
    const clusters: AedCluster[] = clusterResults.map((row) => ({
      id: `cluster_${row.center_lat.toFixed(4)}_${row.center_lng.toFixed(4)}`,
      center: {
        lat: row.center_lat,
        lng: row.center_lng,
      },
      count: Number(row.count),
      bounds: {
        minLat: row.min_lat,
        maxLat: row.max_lat,
        minLng: row.min_lng,
        maxLng: row.max_lng,
      },
    }));

    // Obtener DEAs individuales (los que no están en clusters)
    const individualQuery = `
      WITH grid_clusters AS (
        SELECT 
          ST_SnapToGrid(
            ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326),
            $5
          ) as cluster_point,
          COUNT(*) as count
        FROM aeds a
        WHERE 
          a.status = 'PUBLISHED'
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
          AND a.latitude BETWEEN $1 AND $2
          AND a.longitude BETWEEN $3 AND $4
        GROUP BY cluster_point
      )
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
        AND ST_SnapToGrid(
          ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326),
          $5
        ) IN (
          SELECT cluster_point 
          FROM grid_clusters 
          WHERE count < $6
        )
      ORDER BY a.created_at DESC
      LIMIT $7
    `;

    const individualResults = await prisma.$queryRawUnsafe<AedMapMarker[]>(
      individualQuery,
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      gridSize,
      minClusterSize,
      limit
    );

    // Calcular estadísticas
    const totalClustered = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
    const totalIndividual = individualResults.length;
    const totalInView = totalClustered + totalIndividual;

    return {
      clusters,
      markers: individualResults,
      stats: {
        total_in_view: totalInView,
        clustered: totalClustered,
        individual: totalIndividual,
      },
    };
  }

  /**
   * Obtiene todos los DEAs individuales sin clustering
   * Para zooms altos donde no se requiere agrupación
   */
  async getIndividualMarkers(bounds: BoundingBox, limit: number): Promise<AedMapMarker[]> {
    const query = `
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
      ORDER BY a.created_at DESC
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
