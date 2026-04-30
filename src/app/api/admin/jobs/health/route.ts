/**
 * Admin API - Jobs Health Check
 *
 * GET /api/admin/jobs/health
 * Get health status of the batch job system
 *
 * Only accessible for users with ADMIN role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { GetJobsHealthUseCase } from "@/batch/application/use-cases";

const repository = new PrismaBatchJobRepository(prisma);

/**
 * GET /api/admin/jobs/health
 * Get health metrics of the job system
 */
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const useCase = new GetJobsHealthUseCase(repository);
    const result = await useCase.execute();

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Error al obtener métricas de salud",
          details: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      healthy: result.healthy,
      data: {
        metrics: result.metrics,
        issues: result.issues,
        recommendations: result.recommendations,
      },
      message: result.healthy
        ? "Sistema de jobs en buen estado"
        : `Sistema con problemas: ${result.issues.length} issue(s) detectados`,
    });
  } catch (error) {
    console.error("[API] Error getting jobs health:", error);
    return NextResponse.json(
      {
        error: "Error al obtener métricas de salud",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
