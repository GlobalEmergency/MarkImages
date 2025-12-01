/**
 * API Route: GET /api/import/[batchId]/errors
 * Obtiene los errores detallados de una importación específica
 */

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/jwt";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    // Verificar que el batch pertenece al usuario
    const batch = await prisma.importBatch.findFirst({
      where: {
        id: batchId,
        imported_by: user.userId,
      },
    });

    if (!batch) {
      return NextResponse.json(
        { error: "Batch no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    // Obtener errores del batch
    const errors = await prisma.importError.findMany({
      where: { import_batch_id: batchId },
      orderBy: [{ severity: "desc" }, { row_number: "asc" }],
    });

    return NextResponse.json(
      {
        success: true,
        errors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching import errors:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
