/**
 * Admin API Route: /api/admin/deas/batch
 * Batch delete AEDs by IDs. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_BATCH_SIZE = 50;

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de IDs no vacío" },
        { status: 400 }
      );
    }

    if (ids.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Máximo ${MAX_BATCH_SIZE} DEAs por operación` },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    if (!ids.every((id) => typeof id === "string")) {
      return NextResponse.json(
        { success: false, error: "Todos los IDs deben ser strings" },
        { status: 400 }
      );
    }

    const validIds = ids as string[];

    // Fetch AEDs with FK references for orphan cleanup
    const aeds = await prisma.aed.findMany({
      where: { id: { in: validIds } },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        location_id: true,
        schedule_id: true,
      },
    });

    if (aeds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se encontraron DEAs con los IDs proporcionados" },
        { status: 404 }
      );
    }

    // Dry-run support
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldDelete: aeds.length,
        details: aeds.map((a) => ({ id: a.id, name: a.name, code: a.code, status: a.status })),
      });
    }

    const foundIds = aeds.map((a) => a.id);
    const locationIds = [...new Set(aeds.map((a) => a.location_id).filter(Boolean))] as string[];
    const scheduleIds = [...new Set(aeds.map((a) => a.schedule_id).filter(Boolean))] as string[];

    console.log(`🗑️ Admin batch deleting ${aeds.length} AEDs: ${foundIds.join(", ")}`);

    await prisma.$transaction(async (tx) => {
      // 1. Delete all AEDs (cascades to images, validations, etc.)
      await tx.aed.deleteMany({ where: { id: { in: foundIds } } });

      // 2. Clean up orphaned locations
      if (locationIds.length > 0) {
        // Find locations still referenced by other AEDs
        const stillReferenced = await tx.aed.findMany({
          where: { location_id: { in: locationIds } },
          select: { location_id: true },
        });
        const referencedLocationIds = new Set(stillReferenced.map((a) => a.location_id));
        const orphanLocationIds = locationIds.filter((id) => !referencedLocationIds.has(id));

        if (orphanLocationIds.length > 0) {
          await tx.aedLocation.deleteMany({ where: { id: { in: orphanLocationIds } } });
        }
      }

      // 3. Clean up orphaned schedules
      if (scheduleIds.length > 0) {
        const stillReferenced = await tx.aed.findMany({
          where: { schedule_id: { in: scheduleIds } },
          select: { schedule_id: true },
        });
        const referencedScheduleIds = new Set(stillReferenced.map((a) => a.schedule_id));
        const orphanScheduleIds = scheduleIds.filter((id) => !referencedScheduleIds.has(id));

        if (orphanScheduleIds.length > 0) {
          await tx.aedSchedule.deleteMany({ where: { id: { in: orphanScheduleIds } } });
        }
      }
    });

    return NextResponse.json({
      success: true,
      deleted: aeds.length,
      details: aeds.map((a) => ({ id: a.id, name: a.name, code: a.code, status: a.status })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error batch deleting AEDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al eliminar DEAs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
