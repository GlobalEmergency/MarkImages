/**
 * Application Use Case: GetAedsWithClustersUseCase
 *
 * Caso de uso que orquesta la obtención de DEAs con clustering.
 * Siguiendo SOLID:
 * - Single Responsibility: Orquestar la lógica de negocio para obtener DEAs
 * - Open/Closed: Extensible mediante inyección de dependencias
 * - Dependency Inversion: Depende de abstracciones (IClusteringService)
 */

import type { BoundingBox, ClusteredAedsResponse, ZoomStrategy } from "@/types/aed";
import type { IClusteringService } from "@/domain/clustering/ports/IClusteringService";

export interface GetAedsWithClustersRequest {
  bounds: BoundingBox;
  zoom: number;
  strategy: ZoomStrategy;
}

/**
 * Caso de uso para obtener DEAs con clustering según estrategia de zoom
 *
 * Responsabilidades:
 * - Decidir si aplicar clustering o devolver marcadores individuales
 * - Invocar el servicio de clustering con los parámetros correctos
 * - Formatear la respuesta según el contrato de la API
 */
export class GetAedsWithClustersUseCase {
  constructor(private readonly clusteringService: IClusteringService) {}

  async execute(request: GetAedsWithClustersRequest): Promise<ClusteredAedsResponse> {
    const { bounds, zoom, strategy } = request;

    // Decisión: ¿Aplicar clustering o devolver individuales?
    if (strategy.clusteringEnabled && strategy.clusterGridSize !== null) {
      // Obtener clusters + marcadores individuales
      const result = await this.clusteringService.calculateClusters({
        bounds,
        gridSize: strategy.clusterGridSize,
        minClusterSize: strategy.minClusterSize,
        limit: strategy.limit,
      });

      return {
        success: true,
        data: {
          clusters: result.clusters,
          markers: result.markers,
        },
        stats: result.stats,
        zoom_level: zoom,
        strategy: this.getStrategyDescription(strategy),
      };
    } else {
      // Solo marcadores individuales (sin clustering)
      const markers = await this.clusteringService.getIndividualMarkers(bounds, strategy.limit);

      return {
        success: true,
        data: {
          clusters: [],
          markers,
        },
        stats: {
          total_in_view: markers.length,
          clustered: 0,
          individual: markers.length,
        },
        zoom_level: zoom,
        strategy: "individual markers",
      };
    }
  }

  /**
   * Genera una descripción legible de la estrategia aplicada
   */
  private getStrategyDescription(strategy: ZoomStrategy): string {
    if (!strategy.clusteringEnabled) {
      return "individual markers";
    }

    const gridKm = (strategy.clusterGridSize || 0) * 111; // Aproximación 1° ≈ 111km
    return `clustered (grid ~${gridKm.toFixed(1)}km, min ${strategy.minClusterSize} DEAs)`;
  }
}
