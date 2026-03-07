import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/admin/cleanup/rejected-aeds
 * Elimina DEAs rechazados/inactivos que nunca fueron publicados y tienen más de X días.
 *
 * Targets:
 * - INACTIVE AEDs with status_metadata.reason = REJECTED_VERIFICATION or DUPLICATE
 * - REJECTED AEDs (any reason)
 *
 * Both must have published_at = null and be older than `days` param (default 30).
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

    // Buscar DEAs a eliminar: REJECTED (any) + INACTIVE (with specific metadata)
    const deassToDelete = await prisma.aed.findMany({
      where: {
        published_at: null, // Solo los que nunca fueron publicados
        created_at: { lt: cutoffDate },
        OR: [
          // REJECTED AEDs — any reason
          { status: "REJECTED" },
          // INACTIVE AEDs — only with specific rejection/duplicate metadata
          {
            status: "INACTIVE",
            OR: [
              { status_metadata: { path: ["reason"], equals: "REJECTED_VERIFICATION" } },
              { status_metadata: { path: ["reason"], equals: "DUPLICATE" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        created_at: true,
        status_metadata: true,
        location_id: true,
        schedule_id: true,
      },
    });

    // Si es dry run, solo devolver lo que se eliminaría
    if (dryRun) {
      return NextResponse.json({
        message: "Simulación de limpieza",
        wouldDelete: deassToDelete.length,
        details: deassToDelete.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          status: d.status,
          created_at: d.created_at,
          reason: (d.status_metadata as Record<string, unknown>)?.reason,
        })),
      });
    }

    // Eliminar DEAs en una transacción
    // Using cascade deletes (configured in schema) — no need to manually
    // delete images, validations, etc.
    const deletedIds = deassToDelete.map((d) => d.id);
    const locationIds = [
      ...new Set(deassToDelete.map((d) => d.location_id).filter(Boolean)),
    ] as string[];
    const scheduleIds = [
      ...new Set(deassToDelete.map((d) => d.schedule_id).filter(Boolean)),
    ] as string[];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all AEDs (cascades handle related records)
      const deleted = await tx.aed.deleteMany({
        where: { id: { in: deletedIds } },
      });

      // 2. Clean up orphaned locations
      if (locationIds.length > 0) {
        const stillReferenced = await tx.aed.findMany({
          where: { location_id: { in: locationIds } },
          select: { location_id: true },
        });
        const referencedIds = new Set(stillReferenced.map((a) => a.location_id));
        const orphanIds = locationIds.filter((id) => !referencedIds.has(id));
        if (orphanIds.length > 0) {
          await tx.aedLocation.deleteMany({ where: { id: { in: orphanIds } } });
        }
      }

      // 3. Clean up orphaned schedules
      if (scheduleIds.length > 0) {
        const stillReferenced = await tx.aed.findMany({
          where: { schedule_id: { in: scheduleIds } },
          select: { schedule_id: true },
        });
        const referencedIds = new Set(stillReferenced.map((a) => a.schedule_id));
        const orphanIds = scheduleIds.filter((id) => !referencedIds.has(id));
        if (orphanIds.length > 0) {
          await tx.aedSchedule.deleteMany({ where: { id: { in: orphanIds } } });
        }
      }

      return deleted;
    });

    return NextResponse.json({
      message: "DEAs eliminados exitosamente",
      deleted: result.count,
      details: deassToDelete.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        status: d.status,
        created_at: d.created_at,
        reason: (d.status_metadata as Record<string, unknown>)?.reason,
      })),
    });
  } catch (error) {
    console.error("Error cleaning up rejected AEDs:", error);
    return NextResponse.json({ error: "Error al limpiar DEAs rechazados" }, { status: 500 });
  }
}
