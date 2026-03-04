import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/admin/cleanup/rejected-aeds
 * Elimina DEAs rechazados que nunca fueron publicados y tienen más de X días
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get("days") || "30", 10);
    const dryRun = searchParams.get("dryRun") === "true";

    // Calcular fecha de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Buscar DEAs a eliminar
    const deassToDelete = await prisma.aed.findMany({
      where: {
        status: "INACTIVE",
        published_at: null, // Solo los que nunca fueron publicados
        created_at: { lt: cutoffDate },
        OR: [
          { status_metadata: { path: ["reason"], equals: "REJECTED_VERIFICATION" } },
          { status_metadata: { path: ["reason"], equals: "DUPLICATE" } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        created_at: true,
        status_metadata: true,
      },
    });

    // Si es dry run, solo devolver lo que se eliminaría
    if (dryRun) {
      return NextResponse.json({
        message: "Simulación de limpieza",
        wouldDelete: deassToDelete.length,
        details: deassToDelete,
      });
    }

    // Eliminar DEAs en una transacción
    const result = await prisma.$transaction(async (tx) => {
      const deletedIds = deassToDelete.map((d) => d.id);

      // Eliminar imágenes primero (por la relación)
      await tx.aedImage.deleteMany({
        where: { aed_id: { in: deletedIds } },
      });

      // Eliminar validaciones
      await tx.aedValidation.deleteMany({
        where: { aed_id: { in: deletedIds } },
      });

      // Eliminar cambios de estado
      await tx.aedStatusChange.deleteMany({
        where: { aed_id: { in: deletedIds } },
      });

      // Eliminar historial de códigos
      await tx.aedCodeHistory.deleteMany({
        where: { aed_id: { in: deletedIds } },
      });

      // Finalmente eliminar los DEAs
      const deleted = await tx.aed.deleteMany({
        where: { id: { in: deletedIds } },
      });

      return deleted;
    });

    return NextResponse.json({
      message: "DEAs eliminados exitosamente",
      deleted: result.count,
      details: deassToDelete.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        created_at: d.created_at,
        reason: (d.status_metadata as Record<string, unknown>)?.reason,
      })),
    });
  } catch (error) {
    console.error("Error cleaning up rejected AEDs:", error);
    return NextResponse.json({ error: "Error al limpiar DEAs rechazados" }, { status: 500 });
  }
}
