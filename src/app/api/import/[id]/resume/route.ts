/**
 * Resume Import API — Dual-mode
 *
 * POST /api/import/[id]/resume - Resume/continue a waiting or interrupted import
 *
 * Soporta dos motores:
 * - engine=bulkimport → @batchactions/import via BulkImportService
 * - legacy (sin engine) → BatchJobOrchestrator via ContinueBatchJobUseCase
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { UserRole } from "@/generated/client/enums";
import { getBulkImportService } from "@/import/infrastructure/factories/createBulkImportService";
import type { ImportContext } from "@/import/infrastructure/state/PrismaStateStore";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/import/[id]/resume
 * Resume/continue an import (dual-mode: bulkimport / legacy)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    console.log(`📥 [Import Resume] Resuming import ${id} by user ${user.userId}`);

    // Leer metadata del job para determinar el motor
    const job = await prisma.batchJob.findUnique({
      where: { id },
      select: { metadata: true, created_by: true, status: true },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: `Job ${id} not found` }, { status: 404 });
    }

    // Verificar que el usuario es dueño del job o admin
    if (job.created_by !== user.userId && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "No autorizado para reanudar este job" },
        { status: 403 }
      );
    }

    const metadata = (job.metadata || {}) as Record<string, unknown>;

    // ========================================
    // Motor: @batchactions/import
    // ========================================
    if (metadata.engine === "bulkimport") {
      const importContext = metadata.import_context as ImportContext | undefined;

      if (!importContext?.s3Url) {
        return NextResponse.json(
          { success: false, error: "Import context missing s3Url — cannot resume" },
          { status: 400 }
        );
      }

      const service = getBulkImportService();
      const result = await service.resumeImport({
        jobId: id,
        s3Url: importContext.s3Url,
        userId: job.created_by,
        fileName: importContext.fileName,
        delimiter: importContext.delimiter,
        sharePointAuth: importContext.sharePointAuth,
        maxDurationMs: 80_000,
        skipDuplicates: importContext.skipDuplicates,
      });

      const hasMore = !result.chunk.done;

      console.log(
        `✅ [Import Resume] BulkImport ${id} resumed: ` +
          `${result.progress.processedRecords}/${result.progress.totalRecords} records ` +
          `(${hasMore ? "more pending" : "completed"})`
      );

      return NextResponse.json({
        success: true,
        progress: {
          totalRecords: result.progress.totalRecords,
          processedRecords: result.progress.processedRecords,
          failedRecords: result.progress.failedRecords,
          percentage: result.progress.percentage,
          hasMore,
        },
        shouldContinue: hasMore,
        isComplete: !hasMore,
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
    const { ContinueBatchJobUseCase } = await import("@/batch/application/use-cases");
    const { initializeProcessors } = await import("@/batch/application/processors");
    const { PrismaDataSourceRepository } =
      await import("@/import/infrastructure/repositories/PrismaDataSourceRepository");

    const repository = new PrismaBatchJobRepository(prisma);
    const dataSourceRepository = new PrismaDataSourceRepository(prisma);
    initializeProcessors(prisma, dataSourceRepository);

    const orchestrator = new BatchJobOrchestrator(repository);
    const useCase = new ContinueBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId: id });

    if (!result.success) {
      const status = result.error?.includes("not found")
        ? 404
        : result.error?.includes("Cannot continue")
          ? 400
          : 500;

      console.error(`❌ [Import Resume] Failed to resume legacy import ${id}:`, result.error);

      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status }
      );
    }

    console.log(
      `✅ [Import Resume] Legacy import ${id} resumed: ` +
        `${result.job?.progress.processedRecords}/${result.job?.progress.totalRecords} records`
    );

    return NextResponse.json({
      success: true,
      job: result.job?.toJSON(),
      progress: result.chunkResult?.progress,
      shouldContinue: result.chunkResult?.shouldContinue,
      isComplete: result.isComplete,
    });
  } catch (error) {
    console.error("❌ [Import Resume] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
