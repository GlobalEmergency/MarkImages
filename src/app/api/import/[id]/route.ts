/**
 * Import Batch Details API
 *
 * GET /api/import/[id] - Get details of a specific import batch
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { GetBatchJobDetailsUseCase } from "@/batch/application/use-cases/GetBatchJobDetailsUseCase";

/**
 * GET /api/import/[id]
 * Obtiene los detalles completos de un batch de importación
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticación
    await requireAuth(request);

    const { id } = await params;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "ID de batch inválido" }, { status: 400 });
    }

    // Obtener detalles usando el use case
    const useCase = new GetBatchJobDetailsUseCase(prisma);
    const details = await useCase.execute({ batchId: id });

    if (!details) {
      return NextResponse.json({ error: "Batch de importación no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: details });
  } catch (error) {
    console.error("Error getting import batch details:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
