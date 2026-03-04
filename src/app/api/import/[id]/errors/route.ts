/**
 * Import Batch Errors API
 *
 * GET /api/import/[id]/errors - Get errors from a specific import batch
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { GetBatchJobErrorsUseCase } from "@/batch/application/use-cases/GetBatchJobErrorsUseCase";

/**
 * GET /api/import/[id]/errors
 * Obtiene los errores de un batch de importación con paginación
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticación
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "ID de batch inválido" }, { status: 400 });
    }

    // Parsear parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

    // Validar parámetros
    if (page < 1 || limit < 1) {
      return NextResponse.json({ error: "Parámetros de paginación inválidos" }, { status: 400 });
    }

    // Verificar que el batch existe
    const batchExists = await prisma.batchJob.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!batchExists) {
      return NextResponse.json({ error: "Batch de importación no encontrado" }, { status: 404 });
    }

    // Obtener errores usando el use case
    const useCase = new GetBatchJobErrorsUseCase(prisma);
    const result = await useCase.execute({
      batchId: id,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error getting import batch errors:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
