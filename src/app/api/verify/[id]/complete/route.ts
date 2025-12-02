import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Find the active validation
    const validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
    });

    if (!validation) {
      return NextResponse.json({ error: "Sesión de verificación no encontrada" }, { status: 404 });
    }

    // Update validation status to COMPLETED
    const updatedValidation = await prisma.aedValidation.update({
      where: { id: validation.id },
      data: {
        status: "COMPLETED",
        completed_at: new Date(),
        result: {
          completed_by: user.userId,
          completed_at: new Date(),
        },
      },
    });

    // Update AED status to VERIFIED
    await prisma.aed.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        updated_by: user.userId,
      },
    });

    return NextResponse.json(updatedValidation);
  } catch (error) {
    console.error("Error completing verification:", error);
    return NextResponse.json({ error: "Error al completar verificación" }, { status: 500 });
  }
}
