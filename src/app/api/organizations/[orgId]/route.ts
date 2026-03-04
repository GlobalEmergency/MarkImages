import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await requireAuth(request);

    const { orgId } = await params;

    // Verificar que el usuario pertenece a la organización
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organization_id: orgId,
        user_id: user.userId,
      },
    });

    if (!membership && user.role !== "ADMIN") {
      return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
    }

    // Obtener detalles de la organización
    const organization = await prisma.organization.findUnique({
      where: {
        id: orgId,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization details:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles de la organización" },
      { status: 500 }
    );
  }
}
