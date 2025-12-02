/**
 * API Route: /api/aeds/by-bounds
 *
 * Geospatial API to fetch AEDs within a bounding box with server-side clustering
 * Optimized for map visualization with large datasets
 *
 * Arquitectura:
 * - Capa de Interfaces (este archivo): Recibe requests HTTP
 * - Capa de Aplicación: Caso de uso GetAedsWithClustersUseCase
 * - Capa de Dominio: Puerto IClusteringService
 * - Capa de Infraestructura: Adapter PostGISClusteringAdapter
 */

import { NextRequest, NextResponse } from "next/server";

import { getQueryStrategy, isValidBoundingBox } from "@/lib/zoom-strategy";
import { GetAedsWithClustersUseCase } from "@/application/clustering/use-cases/GetAedsWithClustersUseCase";
import { PostGISClusteringAdapter } from "@/infrastructure/clustering/adapters/PostGISClusteringAdapter";

/**
 * GET /api/aeds/by-bounds
 * Fetch AEDs within a geographic bounding box with clustering
 *
 * Query params:
 * - minLat: minimum latitude (required)
 * - maxLat: maximum latitude (required)
 * - minLng: minimum longitude (required)
 * - maxLng: maximum longitude (required)
 * - zoom: map zoom level 0-20 (optional, default: 12)
 *
 * Response:
 * - clusters[]: Agrupaciones de DEAs con centro, conteo y bounds
 * - markers[]: DEAs individuales con datos completos
 * - stats: Estadísticas de total, clustered e individual
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate parameters
    const minLat = parseFloat(searchParams.get("minLat") || "");
    const maxLat = parseFloat(searchParams.get("maxLat") || "");
    const minLng = parseFloat(searchParams.get("minLng") || "");
    const maxLng = parseFloat(searchParams.get("maxLng") || "");
    const zoom = parseInt(searchParams.get("zoom") || "12", 10);

    // Validate coordinates
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLng) || isNaN(maxLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          message:
            "All bounding box coordinates (minLat, maxLat, minLng, maxLng) are required and must be valid numbers",
        },
        { status: 400 }
      );
    }

    // Validate bounding box
    if (!isValidBoundingBox(minLat, maxLat, minLng, maxLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid bounding box",
          message: "Bounding box coordinates are invalid or out of range",
        },
        { status: 400 }
      );
    }

    // Get query strategy based on zoom level
    const strategy = getQueryStrategy(zoom);

    // Dependency Injection: Crear instancias siguiendo SOLID
    const clusteringService = new PostGISClusteringAdapter();
    const useCase = new GetAedsWithClustersUseCase(clusteringService);

    // Execute use case
    const response = await useCase.execute({
      bounds: {
        minLat,
        maxLat,
        minLng,
        maxLng,
      },
      zoom,
      strategy,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching AEDs by bounds:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AEDs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
