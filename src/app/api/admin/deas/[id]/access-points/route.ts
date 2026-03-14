/**
 * Admin API Route: /api/admin/deas/[id]/access-points
 * CRUD for AED access points — curator-managed data describing
 * how to physically reach a specific AED (doors, routes, restrictions).
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

type AccessPointType = (typeof VALID_ACCESS_POINT_TYPES)[number];
type AccessRestrictionType = (typeof VALID_RESTRICTION_TYPES)[number];

// ── GET /api/admin/deas/[id]/access-points ──────────────────────────

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdminOrAedPermission(request, id, "can_view");

    const accessPoints = await prisma.aedAccessPoint.findMany({
      where: { aed_id: id },
      include: {
        images: {
          select: {
            id: true,
            type: true,
            original_url: true,
            thumbnail_url: true,
            order: true,
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: accessPoints,
      count: accessPoints.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching access points:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener puntos de acceso" },
      { status: 500 }
    );
  }
}

// ── POST /api/admin/deas/[id]/access-points ─────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireAdminOrAedPermission(request, id, "can_edit");

    // Verify AED exists
    const aed = await prisma.aed.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!aed) {
      return NextResponse.json({ success: false, error: "DEA no encontrado" }, { status: 404 });
    }

    const body = await request.json();

    // ── Validate required fields ──
    const errors: string[] = [];

    if (typeof body.latitude !== "number" || body.latitude < -90 || body.latitude > 90) {
      errors.push("latitude debe ser un número entre -90 y 90");
    }
    if (typeof body.longitude !== "number" || body.longitude < -180 || body.longitude > 180) {
      errors.push("longitude debe ser un número entre -180 y 180");
    }
    if (!body.type || !VALID_ACCESS_POINT_TYPES.includes(body.type)) {
      errors.push(`type debe ser uno de: ${VALID_ACCESS_POINT_TYPES.join(", ")}`);
    }
    if (body.restriction_type && !VALID_RESTRICTION_TYPES.includes(body.restriction_type)) {
      errors.push(`restriction_type debe ser uno de: ${VALID_RESTRICTION_TYPES.join(", ")}`);
    }
    if (
      body.estimated_minutes != null &&
      (typeof body.estimated_minutes !== "number" || body.estimated_minutes < 0)
    ) {
      errors.push("estimated_minutes debe ser un número positivo");
    }
    if (body.indoor_steps != null && !Array.isArray(body.indoor_steps)) {
      errors.push("indoor_steps debe ser un array de strings");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: "Errores de validación", details: errors },
        { status: 400 }
      );
    }

    // ── Create within transaction (handle is_primary uniqueness) ──
    const accessPoint = await prisma.$transaction(async (tx) => {
      // If this is marked as primary, unset any existing primary
      if (body.is_primary) {
        await tx.aedAccessPoint.updateMany({
          where: { aed_id: id, is_primary: true },
          data: { is_primary: false },
        });
      }

      return tx.aedAccessPoint.create({
        data: {
          aed_id: id,
          latitude: body.latitude,
          longitude: body.longitude,
          type: body.type as AccessPointType,
          label: body.label ?? null,
          is_primary: body.is_primary ?? false,

          restriction_type: (body.restriction_type as AccessRestrictionType) ?? "NONE",
          unlock_code: body.unlock_code ?? null,
          contact_phone: body.contact_phone ?? null,
          contact_name: body.contact_name ?? null,

          available_24h: body.available_24h ?? true,
          schedule_notes: body.schedule_notes ?? null,

          floor_difference: body.floor_difference ?? null,
          has_elevator: body.has_elevator ?? null,
          estimated_minutes: body.estimated_minutes ?? null,
          indoor_steps: body.indoor_steps ?? null,

          emergency_phone: body.emergency_phone ?? null,
          can_deliver_to_entrance: body.can_deliver_to_entrance ?? false,

          created_by: user.userId,
        },
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

    return NextResponse.json({ success: true, data: accessPoint }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error creating access point:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear punto de acceso" },
      { status: 500 }
    );
  }
}
