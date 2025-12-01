/**
 * API Route: Preview de CSV
 * POST /api/import/preview
 * Genera un preview del CSV subido y sugerencias de mapeo
 */

import { NextRequest, NextResponse } from 'next/server';

import { ParseCsvPreviewUseCase } from '@/application/import/use-cases/ParseCsvPreviewUseCase';
import { SuggestColumnMappingUseCase } from '@/application/import/use-cases/SuggestColumnMappingUseCase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    // Validar que sea CSV
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos CSV' },
        { status: 400 }
      );
    }

    // Guardar archivo temporalmente
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tmpDir = path.join(os.tmpdir(), 'dea-imports');
    await fs.mkdir(tmpDir, { recursive: true });

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `preview-${timestamp}-${randomId}.csv`;
    const filePath = path.join(tmpDir, fileName);

    // Guardar archivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    console.log(`📁 Preview file saved: ${filePath}`);

    // Parsear CSV y generar preview
    const parseUseCase = new ParseCsvPreviewUseCase();
    const parseResult = await parseUseCase.execute({
      filePath,
      sampleSize: 5,
      delimiter: ';',
    });

    if (!parseResult.success || !parseResult.preview) {
      // Limpiar archivo
      await fs.unlink(filePath);
      return NextResponse.json(
        { error: parseResult.error || 'Error al parsear el CSV' },
        { status: 400 }
      );
    }

    // Generar sugerencias de mapeo
    const suggestUseCase = new SuggestColumnMappingUseCase();
    const suggestions = suggestUseCase.execute({
      preview: parseResult.preview,
      prioritizeRequired: true,
    });

    // Retornar preview, sugerencias y sessionId
    const sessionId = `session-${timestamp}-${randomId}`;

    return NextResponse.json({
      sessionId,
      filePath,
      fileName: file.name,
      preview: parseResult.preview.toJSON(),
      suggestions: suggestions.suggestions.map((s) => s.toJSON()),
      stats: suggestions.stats,
      unmappedColumns: suggestions.unmappedColumns,
      missingRequiredFields: suggestions.missingRequiredFields,
    });
  } catch (error) {
    console.error('Error in preview API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
