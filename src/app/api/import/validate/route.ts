/**
 * API Route: Validar datos del CSV
 * POST /api/import/validate
 * Pre-valida los datos usando los mapeos configurados
 */

import { NextRequest, NextResponse } from "next/server";

import { PreValidateDataUseCase } from "@/application/import/use-cases/PreValidateDataUseCase";
import { ColumnMapping } from "@/domain/import/value-objects/ColumnMapping";
import { CsvPreview } from "@/domain/import/value-objects/CsvPreview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, preview, mappings, maxRowsToValidate } = body;

    if (!filePath || !preview || !mappings) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    // Reconstruir objetos de dominio desde JSON
    const csvPreview = CsvPreview.fromJSON(preview);
    const columnMappings = mappings.map((m: any) => ColumnMapping.fromJSON(m));

    // Ejecutar validación
    const validateUseCase = new PreValidateDataUseCase();
    const result = await validateUseCase.execute({
      preview: csvPreview,
      mappings: columnMappings,
      filePath,
      maxRowsToValidate: maxRowsToValidate || 100,
    });

    return NextResponse.json({
      validation: result.validation.toJSON(),
      summary: result.summary,
      sharepoint: result.sharepoint,
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
