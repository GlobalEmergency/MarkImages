/**
 * Domain Port: IClusteringService
 *
 * Interface que define el contrato para servicios de clustering geoespacial.
 * Siguiendo SOLID - Dependency Inversion Principle (DIP):
 * - El dominio define la abstracción
 * - La infraestructura implementa los detalles
 */

import type { AedCluster, AedMapMarker, BoundingBox } from "@/types/aed";

export interface ClusteringParams {
  bounds: BoundingBox;
  gridSize: number;
  minClusterSize: number;
  limit: number;
}

export interface ClusteringResult {
  clusters: AedCluster[];
  markers: AedMapMarker[];
  stats: {
    total_in_view: number;
    clustered: number;
    individual: number;
  };
}

/**
 * Puerto para servicios de clustering
 * Define el contrato que debe cumplir cualquier implementación
 */
export interface IClusteringService {
  /**
   * Calcula clusters y marcadores individuales dentro de un área geográfica
   *
   * @param params - Parámetros de clustering
   * @returns Resultado con clusters y marcadores individuales
   */
  calculateClusters(params: ClusteringParams): Promise<ClusteringResult>;

  /**
   * Obtiene todos los DEAs individuales sin clustering
   *
   * @param bounds - Límites geográficos
   * @param limit - Número máximo de resultados
   * @returns Lista de marcadores
   */
  getIndividualMarkers(bounds: BoundingBox, limit: number): Promise<AedMapMarker[]>;
}
