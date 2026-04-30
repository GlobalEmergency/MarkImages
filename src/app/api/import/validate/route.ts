/**
 * API Route: Validar datos del CSV
 * POST /api/import/validate
 * Pre-valida los datos usando los mapeos configurados
 *
 * NO crea BatchJob, solo valida en memoria (rápido y limpio)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ValidateAedImportUseCase } from "@/import/application/use-cases/ValidateAedImportUseCase";
import { AedImportOrchestrator } from "@/import/application/services/AedImportOrchestrator";
import { CsvParsingService } from "@/import/application/services/CsvParsingService";
import { ColumnMappingService } from "@/import/application/services/ColumnMappingService";
import { AedValidationService } from "@/import/domain/services/AedValidationService";
import { CoordinateValidationService } from "@/import/domain/services/CoordinateValidationService";
import { DuplicateDetectionService } from "@/import/domain/services/DuplicateDetectionService";
import { PrismaAedRepository } from "@/import/infrastructure/repositories/PrismaAedRepository";

// Crear instancias de servicios (Dependency Injection manual)
const csvParser = new CsvParsingService();
const mapper = new ColumnMappingService();
const aedValidator = new AedValidationService();
const coordValidator = new CoordinateValidationService();
const aedRepository = new PrismaAedRepository(prisma);
const duplicateDetector = new DuplicateDetectionService(aedRepository);

const orchestrator = new AedImportOrchestrator(
  csvParser,
  mapper,
  aedValidator,
  coordValidator,
  duplicateDetector
);

const validateUseCase = new ValidateAedImportUseCase(orchestrator);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, mappings, maxRowsToValidate = 100 } = body;

    if (!filePath || !mappings) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos (filePath, mappings)" },
        { status: 400 }
      );
    }

    // Convert mappings to the format expected by the use case
    const columnMappings = mappings.map(
      (m: { csvColumn: string; systemFieldKey?: string; systemField?: string }) => ({
        csvColumn: m.csvColumn,
        systemField: m.systemFieldKey || m.systemField,
      })
    );

    // Execute validation (NO BatchJob created)
    const validationResult = await validateUseCase.execute({
      filePath,
      mappings: columnMappings,
      delimiter: ";",
      maxRows: maxRowsToValidate,
      skipDuplicates: true,
    });

    // Transform to API response format
    const summary = validationResult.toSummary(50, 20);

    return NextResponse.json({
      success: true,
      validation: {
        isValid: summary.isValid,
        totalRecords: summary.totalRecords,
        validRecords: summary.validRecords,
        invalidRecords: summary.invalidRecords,
        skippedRecords: summary.skippedRecords,
        warningRecords: summary.warningRecords,
      },
      summary: {
        recordsAnalyzed: summary.processedRecords,
        wouldCreate: summary.wouldCreate,
        wouldSkip: summary.wouldSkip,
        errors: summary.errors.length,
        warnings: summary.warnings.length,
      },
      errors: summary.errors,
      errorSummary: summary.errorSummary,
      warnings: summary.warnings,
      previewRecords: summary.previewRecords,
      sharepoint: summary.sharepoint,
    });
  } catch (error) {
    console.error("Error in validate API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
