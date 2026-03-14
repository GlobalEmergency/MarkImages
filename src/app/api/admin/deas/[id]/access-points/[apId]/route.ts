/**
 * Admin API Route: /api/admin/deas/[id]/access-points/[apId]
 * Update or delete an individual AED access point.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrAedPermission, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_ACCESS_POINT_TYPES = [
  "PEDESTRIAN",
  "VEHICLE",
  "EMERGENCY",
  "WHEELCHAIR",
  "UNIVERSAL",
] as const;

const VALID_RESTRICTION_TYPES = [
  "NONE",
  "CODE",
  "KEY",
  "CARD",
  "INTERCOM",
  "SECURITY_GUARD",
  "LOCKED_HOURS",
] as const;

type RouteParams = { params: Promise<{ id: string; apId: string }> };

// Allowed fields for PATCH updates
const ALLOWED_FIELDS = new Set([
  "latitude",
  "longitude",
  "type",
  "label",
  "is_primary",
  "restriction_type",
  "unlock_code",
  "contact_phone",
  "contact_name",
  "available_24h",
  "schedule_notes",
  "floor_difference",
  "has_elevator",
  "estimated_minutes",
  "indoor_steps",
  "emergency_phone",
  "can_deliver_to_entrance",
  "verified",
]);

// ── PATCH /api/admin/deas/[id]/access-points/[apId] ────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, apId } = await params;
    const { user } = await requireAdminOrAedPermission(request, id, "can_edit");

    // Verify access point exists and belongs to this AED
    const existing = await prisma.aedAccessPoint.findFirst({
      where: { id: apId, aed_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Punto de acceso no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // ── Filter to allowed fields only ──
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron campos válidos para actualizar" },
        { status: 400 }
      );
    }

    // ── Validate specific fields ──
    const errors: string[] = [];

    if ("latitude" in updateData) {
      const lat = updateData.latitude;
      if (typeof lat !== "number" || lat < -90 || lat > 90) {
        errors.push("latitude debe ser un número entre -90 y 90");
      }
    }
    if ("longitude" in updateData) {
      const lng = updateData.longitude;
      if (typeof lng !== "number" || lng < -180 || lng > 180) {
        errors.push("longitude debe ser un número entre -180 y 180");
      }
    }
    if (
      "type" in updateData &&
      !VALID_ACCESS_POINT_TYPES.includes(
        updateData.type as (typeof VALID_ACCESS_POINT_TYPES)[number]
      )
    ) {
      errors.push(`type debe ser uno de: ${VALID_ACCESS_POINT_TYPES.join(", ")}`);
    }
    if (
      "restriction_type" in updateData &&
      !VALID_RESTRICTION_TYPES.includes(
        updateData.restriction_type as (typeof VALID_RESTRICTION_TYPES)[number]
      )
    ) {
      errors.push(`restriction_type debe ser uno de: ${VALID_RESTRICTION_TYPES.join(", ")}`);
    }
    if ("estimated_minutes" in updateData && updateData.estimated_minutes != null) {
      if (typeof updateData.estimated_minutes !== "number" || updateData.estimated_minutes < 0) {
        errors.push("estimated_minutes debe ser un número positivo");
      }
    }
    if (
      "indoor_steps" in updateData &&
      updateData.indoor_steps != null &&
      !Array.isArray(updateData.indoor_steps)
    ) {
      errors.push("indoor_steps debe ser un array de strings");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: "Errores de validación", details: errors },
        { status: 400 }
      );
    }

    // ── Update within transaction (handle is_primary uniqueness) ──
    const updated = await prisma.$transaction(async (tx) => {
      if (updateData.is_primary === true) {
        await tx.aedAccessPoint.updateMany({
          where: { aed_id: id, is_primary: true, id: { not: apId } },
          data: { is_primary: false },
        });
      }

      // Track who verified if setting verified=true
      if (updateData.verified === true && !existing.verified) {
        updateData.verified_by = user.userId;
      }

      return tx.aedAccessPoint.update({
        where: { id: apId },
        data: updateData,
        include: {
          images: {
            select: {
              id: true,
              type: true,
              original_url: true,
              thumbnail_url: true,
              order: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error updating access point:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar punto de acceso" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/admin/deas/[id]/access-points/[apId] ────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, apId } = await params;
    await requireAdminOrAedPermission(request, id, "can_edit");

    // Verify access point exists and belongs to this AED
    const existing = await prisma.aedAccessPoint.findFirst({
      where: { id: apId, aed_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Punto de acceso no encontrado" },
        { status: 404 }
      );
    }

    // Delete (images are unlinked via onDelete: SetNull, not lost)
    await prisma.aedAccessPoint.delete({
      where: { id: apId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error deleting access point:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar punto de acceso" },
      { status: 500 }
    );
  }
}
