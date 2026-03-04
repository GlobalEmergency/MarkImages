/**
 * Cancel Import API — Dual-mode
 *
 * POST /api/import/[id]/cancel - Cancel a running or waiting import
 *
 * Soporta dos motores:
 * - engine=bulkimport → Update directo en Prisma (status → CANCELLED)
 * - legacy (sin engine) → CancelBatchJobUseCase via BatchJobOrchestrator
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { UserRole } from "@/generated/client/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/import/[id]/cancel
 * Cancel an import (dual-mode: bulkimport / legacy)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    console.log(`🚫 [Import Cancel] Cancelling import ${id} by user ${user.userId}`);

    // Leer metadata del job para determinar el motor
    const job = await prisma.batchJob.findUnique({
      where: { id },
      select: { metadata: true, status: true, created_by: true },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: `Job ${id} not found` }, { status: 404 });
    }

    // Verificar que el usuario es dueño del job o admin
    if (job.created_by !== user.userId && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "No autorizado para cancelar este job" },
        { status: 403 }
      );
    }

    const metadata = (job.metadata || {}) as Record<string, unknown>;

    // ========================================
    // Motor: @batchactions/import
    // ========================================
    if (metadata.engine === "bulkimport") {
      // Verificar que el job se puede cancelar
      const nonCancellableStatuses = ["COMPLETED", "CANCELLED", "FAILED"];
      if (nonCancellableStatuses.includes(job.status)) {
        return NextResponse.json(
          { success: false, error: `Cannot cancel job in ${job.status} status` },
          { status: 400 }
        );
      }

      // Update directo: marcar como CANCELLED y actualizar metadata
      await prisma.batchJob.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completed_at: new Date(),
          metadata: {
            ...metadata,
            bulkimport_status: "ABORTED",
            cancelled_at: new Date().toISOString(),
            cancel_reason: "Cancelled by user",
          },
        },
      });

      console.log(`✅ [Import Cancel] BulkImport ${id} cancelled successfully`);

      return NextResponse.json({
        success: true,
        status: "CANCELLED",
      });
    }

    // ========================================
    // Motor: Legacy (BatchJobOrchestrator)
    // ========================================
    // Lazy-import para no cargar dependencias legacy si no se necesitan
    const { PrismaBatchJobRepository } =
      await import("@/batch/infrastructure/repositories/PrismaBatchJobRepository");
    const { BatchJobOrchestrator } =
      await import("@/batch/application/orchestrator/BatchJobOrchestrator");
    const { CancelBatchJobUseCase } = await import("@/batch/application/use-cases");
    const { initializeProcessors } = await import("@/batch/application/processors");
    const { PrismaDataSourceRepository } =
      await import("@/import/infrastructure/repositories/PrismaDataSourceRepository");

    const repository = new PrismaBatchJobRepository(prisma);
    const dataSourceRepository = new PrismaDataSourceRepository(prisma);
    initializeProcessors(prisma, dataSourceRepository);

    const orchestrator = new BatchJobOrchestrator(repository);
    const useCase = new CancelBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId: id, reason: "Cancelled by user" });

    if (!result.success) {
      const status = result.error?.includes("not found")
        ? 404
        : result.error?.includes("Cannot cancel")
          ? 400
          : 500;

      console.error(`❌ [Import Cancel] Failed to cancel legacy import ${id}:`, result.error);

      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status }
      );
    }

    console.log(`✅ [Import Cancel] Legacy import ${id} cancelled successfully`);

    return NextResponse.json({
      success: true,
      job: result.job?.toJSON(),
    });
  } catch (error) {
    console.error("❌ [Import Cancel] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
