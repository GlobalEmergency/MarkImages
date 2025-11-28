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

    // Extract images from body if present (needs special handling)
    const { images, ...updateData } = body;

    // Build the update data object
    const data: any = {
      ...updateData,
      updated_by: user.userId,
      updated_at: new Date(),
    };

    // Handle images relation separately if provided
    if (images && Array.isArray(images)) {
      data.images = {
        // Delete all existing images
        deleteMany: {},
        // Create new images
        create: images.map((img: any, index: number) => ({
          original_url: img.original_url,
          type: img.type || "FRONT", // Default to FRONT if not specified
          order: img.order ?? index,
          is_verified: false,
        })),
      };
    }

    // Update the AED with the provided data
    const updatedAed = await prisma.aed.update({
      where: { id },
      data,
      include: {
        images: true,
      },
    });

    return NextResponse.json(updatedAed);
  } catch (error) {
    console.error("Error updating AED:", error);
    return NextResponse.json({ error: "Error al actualizar DEA" }, { status: 500 });
  }
}
