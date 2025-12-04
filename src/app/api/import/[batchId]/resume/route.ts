/**
 * API Route: POST /api/import/[batchId]/resume
 * Reanuda una importación interrumpida
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ImportRecoveryService } from "@/lib/recovery/ImportRecoveryService";
import { processImportAsync } from "@/lib/importProcessor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // Configuración del servicio de recuperación
    const config = {
      enabled: true,
      autoResume: false, // No auto-reanudar, es manual
      heartbeatTimeoutMs: parseInt(process.env.IMPORT_HEARTBEAT_TIMEOUT_MS || "300000"),
    };

    const recoveryService = new ImportRecoveryService(prisma, config);

    // Verificar si el batch puede ser reanudado
    const canResume = await recoveryService.canBatchBeResumed(batchId);
    if (!canResume) {
      return NextResponse.json(
        {
          error: "Batch cannot be resumed",
          message: "The batch is not in INTERRUPTED status or was cancelled manually",
        },
        { status: 400 }
      );
    }

    // Obtener información del batch
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        file_name: true,
        imported_by: true,
        import_parameters: true,
        last_checkpoint_index: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Obtener información de reanudación
    const resumeInfo = await recoveryService.getBatchResumeInfo(batchId);
    if (!resumeInfo) {
      return NextResponse.json({ error: "Cannot get resume information" }, { status: 500 });
    }

    // Preparar el batch para reanudación
    await recoveryService.prepareBatchForResume(batchId);

    // Validar que existan parámetros de importación
    const importParams = batch.import_parameters as any;
    if (!importParams) {
      return NextResponse.json(
        {
          error: "Cannot resume",
          message:
            "This batch cannot be resumed because it was created before the recovery system was implemented. Please start a new import.",
        },
        { status: 400 }
      );
    }

    const filePath = importParams.filePath;
    const mappings = importParams.mappings;
    const sharePointAuth = importParams.sharePointAuth;

    if (!filePath) {
      return NextResponse.json(
        {
          error: "Cannot resume",
          message:
            "Import file information is missing. This batch cannot be resumed. Please start a new import.",
        },
        { status: 400 }
      );
    }

    // Reanudar importación en background
    processImportAsync(
      batchId,
      filePath,
      batch.imported_by,
      mappings,
      sharePointAuth,
      true // isResume = true
    ).catch((error) => {
      console.error(`❌ Failed to resume import for batch ${batchId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "Import resumption started",
      batch: {
        id: batch.id,
        name: batch.name,
        lastCheckpointIndex: resumeInfo.lastCheckpointIndex,
        progress: {
          total: resumeInfo.stats.total,
          success: resumeInfo.stats.success,
          failed: resumeInfo.stats.failed,
          skipped: resumeInfo.stats.skipped,
          remaining: resumeInfo.stats.total - (resumeInfo.lastCheckpointIndex + 1),
        },
      },
    });
  } catch (error) {
    console.error("Error resuming import:", error);
    return NextResponse.json(
      {
        error: "Failed to resume import",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
