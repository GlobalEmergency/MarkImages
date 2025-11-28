/**
 * API Route: GET /api/import/[batchId]
 * Consulta el estado de un batch de importación
 */

import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { PrismaImportRepository } from "@/infrastructure/import/repositories/PrismaImportRepository";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    const repository = new PrismaImportRepository(prisma);
    const batchInfo = await repository.getBatchInfo(batchId);

    if (!batchInfo) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Calcular progreso
    const progress = batchInfo.totalRecords > 0
      ? Math.round(
          ((batchInfo.successfulRecords + batchInfo.failedRecords) /
            batchInfo.totalRecords) *
            100
        )
      : 0;

    // Calcular duración
    let durationSeconds = null;
    if (batchInfo.startedAt && batchInfo.completedAt) {
      durationSeconds = Math.floor(
        (batchInfo.completedAt.getTime() - batchInfo.startedAt.getTime()) / 1000
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          batch: {
            id: batchInfo.id,
            name: batchInfo.name,
            status: batchInfo.status,
            createdAt: batchInfo.createdAt,
            startedAt: batchInfo.startedAt,
            completedAt: batchInfo.completedAt,
          },
          progress: {
            total: batchInfo.totalRecords,
            successful: batchInfo.successfulRecords,
            failed: batchInfo.failedRecords,
            percentage: progress,
          },
          stats: {
            durationSeconds,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching batch info:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
