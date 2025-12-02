import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verificar si hay cambio de estado
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentAed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    const hasStatusChange = body.status && body.status !== currentAed.status;

    // Preparar datos de actualización
    const updateData: any = {
      ...body,
      updated_by: user.userId,
      updated_at: new Date(),
    };

    // Si cambia a PUBLISHED, establecer published_at
    if (
      hasStatusChange &&
      body.status === "PUBLISHED" &&
      !currentAed.status.includes("PUBLISHED")
    ) {
      updateData.published_at = new Date();
    }

    // Usar transacción si hay cambio de estado
    if (hasStatusChange) {
      const result = await prisma.$transaction(async (tx: any) => {
        // Actualizar el AED
        const updatedAed = await tx.aed.update({
          where: { id },
          data: updateData,
        });

        // Registrar cambio de estado en el historial
        await tx.aedStatusChange.create({
          data: {
            aed_id: id,
            previous_status: currentAed.status,
            new_status: body.status,
            reason: body.status_metadata?.reason || null,
            notes: body.status_metadata?.details || null,
            modified_by: user.userId,
          },
        });

        return updatedAed;
      });

      return NextResponse.json(result);
    }

    // Si no hay cambio de estado, actualizar directamente
    const updatedAed = await prisma.aed.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedAed);
  } catch (error) {
    console.error("Error updating AED:", error);
    return NextResponse.json({ error: "Error al actualizar DEA" }, { status: 500 });
  }
}
