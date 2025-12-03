import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/aeds/[id]
 * Get a single AED by ID with all relationships
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const aed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: true,
        responsible: true,
        schedule: true,
        images: {
          where: {
            is_verified: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!aed) {
      return NextResponse.json(
        {
          success: false,
          error: "AED not found",
          message: `No AED found with ID: ${id}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: aed,
    });
  } catch (error) {
    console.error("Error fetching AED:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AED",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Extraer deleteImageIds y addImages del body
    const { deleteImageIds, addImages, ...updateFields } = body;

    // Verificar si hay cambio de estado
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentAed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    const hasStatusChange = updateFields.status && updateFields.status !== currentAed.status;
    const hasImageChanges =
      (deleteImageIds && deleteImageIds.length > 0) || (addImages && addImages.length > 0);

    // Preparar datos de actualización
    const updateData: any = {
      ...updateFields,
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

    // Usar transacción si hay cambio de estado o cambio de imágenes
    if (hasStatusChange || hasImageChanges) {
      const result = await prisma.$transaction(async (tx: any) => {
        // Eliminar imágenes si se especificaron
        if (deleteImageIds && deleteImageIds.length > 0) {
          await tx.aedImage.deleteMany({
            where: {
              id: { in: deleteImageIds },
              aed_id: id,
            },
          });
        }

        // Agregar nuevas imágenes si se especificaron
        if (addImages && addImages.length > 0) {
          await tx.aedImage.createMany({
            data: addImages.map((img: any) => ({
              aed_id: id,
              original_url: img.original_url,
              type: img.type || "general",
              order: img.order,
              created_at: new Date(),
            })),
          });
        }

        // Actualizar el AED si hay cambios en los campos
        const updatedAed = await tx.aed.update({
          where: { id },
          data: updateData,
          include: {
            images: {
              orderBy: { order: "asc" },
            },
            location: true,
            responsible: true,
          },
        });

        // Registrar cambio de estado en el historial si aplica
        if (hasStatusChange) {
          await tx.aedStatusChange.create({
            data: {
              aed_id: id,
              previous_status: currentAed.status,
              new_status: updateFields.status,
              reason: updateFields.status_metadata?.reason || null,
              notes: updateFields.status_metadata?.details || null,
              modified_by: user.userId,
            },
          });
        }

        return updatedAed;
      });

      return NextResponse.json(result);
    }

    // Si no hay cambios especiales, actualizar directamente
    const updatedAed = await prisma.aed.update({
      where: { id },
      data: updateData,
      include: {
        images: {
          orderBy: { order: "asc" },
        },
        location: true,
        responsible: true,
      },
    });

    return NextResponse.json(updatedAed);
  } catch (error) {
    console.error("Error updating AED:", error);
    return NextResponse.json({ error: "Error al actualizar DEA" }, { status: 500 });
  }
}
