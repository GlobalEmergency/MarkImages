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

    // Update the AED with the provided data
    const updatedAed = await prisma.aed.update({
      where: { id },
      data: {
        ...body,
        updated_by: user.userId,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedAed);
  } catch (error) {
    console.error("Error updating AED:", error);
    return NextResponse.json({ error: "Error al actualizar DEA" }, { status: 500 });
  }
}
