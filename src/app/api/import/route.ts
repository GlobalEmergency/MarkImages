/**
 * Import Batches API
 *
 * GET /api/import - List import batches (filtered by AED_CSV_IMPORT type)
 *
 * This is a convenience endpoint that wraps the generic batch job API
 * with filtering for CSV imports and transforms the response to the
 * legacy format expected by the frontend.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { JobType } from "@/batch/domain";
import { getBulkImportService } from "@/import/infrastructure/factories/createBulkImportService";
import { uploadToS3 } from "@/lib/s3";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  DEFAULT_CSV_DELIMITER,
  DEFAULT_BATCH_SIZE,
  VERCEL_API_MAX_DURATION_MS,
} from "@/import/constants";

/**
 * GET /api/import
 * List import batches with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    await requireAuth(request);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const skip = (page - 1) * limit;

    // Query batch jobs of type AED_CSV_IMPORT
    const [jobs, total] = await Promise.all([
      prisma.batchJob.findMany({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              errors: true,
              created_aeds: true,
            },
          },
          artifacts: {
            where: {
              type: "FILE",
            },
            take: 1,
          },
        },
      }),
      prisma.batchJob.count({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
      }),
    ]);

    // Transform to legacy format expected by frontend
    const batches = jobs.map((job) => {
      const config = job.config as Record<string, unknown>;
      const sourceFile = job.artifacts[0];

      return {
        id: job.id,
        name: job.name,
        description: job.description,
        source_origin: (config?.sourceOrigin as string) ?? "CSV_IMPORT",
        file_name: sourceFile?.name ?? (config?.fileName as string) ?? null,
        file_url: sourceFile?.file_url ?? (config?.fileUrl as string) ?? null,
        file_size: sourceFile?.file_size ?? (config?.fileSize as number) ?? null,
        total_records: job.total_records,
        successful_records: job.successful_records,
        failed_records: job.failed_records,
        warning_records: job.skipped_records,
        status: job.status,
        completed_at: job.completed_at?.toISOString() ?? null,
        duration_seconds: job.duration_seconds,
        imported_by: job.created_by,
        created_at: job.created_at.toISOString(),
        _count: {
          errors: job._count.errors,
          aeds: job._count.created_aeds,
        },
      };
    });

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing import batches:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import
 * Create and start a new import batch job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { filePath, mappings, batchName, sharepointCookies } = body;

    if (!filePath || !mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "Faltan parÃ¡metros requeridos (filePath, mappings)" },
        { status: 400 }
      );
    }

    // Validar que filePath esté dentro de /tmp o del directorio temporal del OS
    // para prevenir path traversal (lectura/borrado de archivos arbitrarios)
    const resolvedPath = path.resolve(filePath);
    const allowedDirs = [path.resolve("/tmp"), path.resolve(os.tmpdir())];
    const isPathSafe = allowedDirs.some(
      (dir) => resolvedPath.startsWith(dir + path.sep) || resolvedPath === dir
    );

    if (!isPathSafe) {
      console.warn(`🚫 [Import] Rejected unsafe filePath: ${filePath} (resolved: ${resolvedPath})`);
      return NextResponse.json(
        { error: "filePath debe estar dentro del directorio temporal" },
        { status: 400 }
      );
    }

    // Upload CSV file to S3 for persistent storage
    console.log(`ðŸ“¤ [Import] Uploading CSV to S3: ${filePath}`);

    let s3Url: string;
    let fileSize: number;
    let fileHash: string;
    const fileName = path.basename(filePath);

    try {
      // Read file from /tmp
      const fileBuffer = await fs.readFile(filePath);
      fileSize = fileBuffer.length;

      // Calculate file hash for integrity verification
      fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Upload to S3
      s3Url = await uploadToS3({
        buffer: fileBuffer,
        filename: fileName,
        contentType: "text/csv",
        prefix: "batch-jobs/csv-imports",
      });

      console.log(
        `âœ… [Import] CSV uploaded to S3: ${s3Url} (${fileSize} bytes, hash: ${fileHash.substring(0, 8)}...)`
      );

      // Clean up temporary file
      await fs.unlink(filePath);
      console.log(`ðŸ—‘ï¸ [Import] Temporary file deleted: ${filePath}`);
    } catch (error) {
      console.error(`âŒ [Import] Failed to upload CSV to S3:`, error);
      return NextResponse.json(
        { error: "Error al subir el archivo CSV a almacenamiento permanente" },
        { status: 500 }
      );
    }

    // Preparar auth SharePoint si se proporcionÃ³
    const sharePointAuth = sharepointCookies
      ? {
          fedAuth: sharepointCookies.FedAuth || "",
          rtFa: sharepointCookies.rtFa,
        }
      : undefined;

    // Iniciar importaciÃ³n con @batchactions/import â€” procesa primer chunk inline
    console.log(`ðŸš€ [Import] Starting import with @batchactions/import for ${fileName}`);

    const service = getBulkImportService();
    const result = await service.startImport({
      s3Url,
      fileName,
      userId: user.userId,
      delimiter: DEFAULT_CSV_DELIMITER,
      batchSize: DEFAULT_BATCH_SIZE,
      continueOnError: true,
      skipDuplicates: true,
      sharePointAuth,
      maxDurationMs: VERCEL_API_MAX_DURATION_MS,
      jobName: batchName || `ImportaciÃ³n CSV ${new Date().toISOString()}`,
    });

    // Crear artifact para tracking del archivo CSV
    await prisma.batchJobArtifact.create({
      data: {
        job_id: result.jobId,
        type: "FILE",
        name: fileName,
        description: `CSV source file for import job`,
        mime_type: "text/csv",
        file_size: fileSize,
        file_url: s3Url,
        file_hash: fileHash,
      },
    });

    const hasMore = !result.chunk.done;

    console.log(
      `ðŸ“‹ [Import] Job ${result.jobId} â€” first chunk processed: ` +
        `${result.progress.processedRecords}/${result.progress.totalRecords} records ` +
        `(${hasMore ? "more chunks pending" : "completed"})`
    );

    return NextResponse.json({
      success: true,
      batchId: result.jobId,
      status: hasMore ? "IN_PROGRESS" : "COMPLETED",
      progress: {
        totalRecords: result.progress.totalRecords,
        processedRecords: result.progress.processedRecords,
        successfulRecords: Math.max(
          0,
          result.progress.processedRecords - result.progress.failedRecords
        ),
        failedRecords: result.progress.failedRecords,
        percentage: result.progress.percentage,
        hasMore,
      },
      message: hasMore
        ? "Primer lote procesado. Los siguientes se procesarÃ¡n automÃ¡ticamente."
        : "ImportaciÃ³n completada.",
    });
  } catch (error) {
    console.error("Error creating import batch:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error al crear la importaciÃ³n",
      },
      { status: 500 }
    );
  }
}
