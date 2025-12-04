/**
 * API Route: GET /api/import/recovery
 * Lista todas las importaciones que pueden ser reanudadas
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ImportRecoveryService } from "@/lib/recovery/ImportRecoveryService";

export async function GET() {
  try {
    // Configuración del servicio de recuperación
    const config = {
      enabled: true,
      autoResume: false,
      heartbeatTimeoutMs: parseInt(process.env.IMPORT_HEARTBEAT_TIMEOUT_MS || "300000"),
    };

    const recoveryService = new ImportRecoveryService(prisma, config);

    // Listar batches recuperables
    const resumableBatches = await recoveryService.listResumableBatches();

    // Enriquecer con información adicional
    const enrichedBatches = await Promise.all(
      resumableBatches.map(async (batch) => {
        const resumeInfo = await recoveryService.getBatchResumeInfo(batch.id);
        return {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          lastHeartbeat: batch.lastHeartbeat,
          progress: {
            total: batch.totalRecords,
            successful: batch.successfulRecords,
            failed: batch.failedRecords,
            lastCheckpointIndex: batch.lastCheckpointIndex,
            remaining: resumeInfo
              ? resumeInfo.stats.total - (resumeInfo.lastCheckpointIndex + 1)
              : 0,
            percentage:
              batch.totalRecords > 0
                ? Math.round((batch.successfulRecords / batch.totalRecords) * 100)
                : 0,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: enrichedBatches.length,
      batches: enrichedBatches,
    });
  } catch (error) {
    console.error("Error listing resumable imports:", error);
    return NextResponse.json(
      {
        error: "Failed to list resumable imports",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
