/**
 * API Route: POST /api/import/[batchId]/cancel
 * Cancela una importación en progreso o pausada
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // Obtener el batch actual
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        status: true,
        cancelled_manually: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Verificar que el batch puede ser cancelado
    const cancellableStatuses = ["IN_PROGRESS", "PAUSED", "INTERRUPTED", "RESUMING"];
    if (!cancellableStatuses.includes(batch.status)) {
      return NextResponse.json(
        {
          error: "Batch cannot be cancelled",
          message: `Batch is in ${batch.status} status and cannot be cancelled`,
        },
        { status: 400 }
      );
    }

    // Ya cancelado previamente
    if (batch.cancelled_manually) {
      return NextResponse.json(
        {
          success: true,
          message: "Batch was already cancelled",
          batch: {
            id: batch.id,
            name: batch.name,
            status: batch.status,
          },
        },
        { status: 200 }
      );
    }

    // Cancelar el batch
    const updatedBatch = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "CANCELLED",
        cancelled_manually: true,
        completed_at: new Date(),
        error_summary: {
          message: "Import was cancelled by user",
          timestamp: new Date().toISOString(),
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
      },
    });

    console.log(`🛑 Batch ${batchId} cancelled by user`);

    return NextResponse.json({
      success: true,
      message: "Import cancelled successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    console.error("Error cancelling import:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel import",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
