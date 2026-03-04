import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verificar que el usuario pertenece a la organización y tiene permisos para ver miembros
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organization_id: orgId,
        user_id: user.userId,
      },
    });

    // Solo ADMIN global o miembros con can_manage_members pueden ver la lista de miembros
    if (!membership?.can_manage_members && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para ver los miembros" },
        { status: 403 }
      );
    }

    // Obtener miembros de la organización
    const members = await prisma.organizationMember.findMany({
      where: {
        organization_id: orgId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            is_active: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER primero, luego ADMIN, etc.
        { joined_at: "asc" },
      ],
    });

    return NextResponse.json({
      members,
      total: members.length,
    });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json({ error: "Error al obtener miembros" }, { status: 500 });
  }
}
