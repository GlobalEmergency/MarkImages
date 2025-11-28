/**
 * API Route: POST /api/import
 * Inicia la importación de un batch de DEAs desde CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ImportDeaBatchUseCase } from "@/application/import/use-cases/ImportDeaBatchUseCase";
import { CsvParserAdapter } from "@/infrastructure/import/parsers/CsvParserAdapter";
import { PrismaImportRepository } from "@/infrastructure/import/repositories/PrismaImportRepository";
import { SharePointImageDownloader } from "@/infrastructure/storage/adapters/SharePointImageDownloader";
import { S3ImageStorageAdapter } from "@/infrastructure/storage/adapters/S3ImageStorageAdapter";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar request
    if (!body.filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    if (!body.batchName) {
      return NextResponse.json({ error: "batchName is required" }, { status: 400 });
    }

    // Preparar auth para SharePoint si se proporciona
    const sharePointAuth = body.sharePointCookies
      ? {
          type: "cookies" as const,
          cookies: body.sharePointCookies,
        }
      : undefined;

    // Inyección de dependencias
    const repository = new PrismaImportRepository(prisma);
    const csvParser = new CsvParserAdapter();
    const imageDownloader = new SharePointImageDownloader();
    const imageStorage = new S3ImageStorageAdapter();

    const useCase = new ImportDeaBatchUseCase(
      repository,
      csvParser,
      imageDownloader,
      imageStorage
    );

    // Ejecutar importación
    console.log("🚀 Starting import batch...");
    const result = await useCase.execute({
      filePath: body.filePath,
      batchName: body.batchName,
      importedBy: body.importedBy || "system",
      sharePointAuth,
      chunkSize: body.chunkSize || 50,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Import completed",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
