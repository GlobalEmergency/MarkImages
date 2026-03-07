import { NextRequest, NextResponse } from "next/server";

import { requireAuth, getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";
import { validateStatusTransition } from "@/lib/aed-status";

/**
 * GET /api/aeds/[id]
 * Get a single AED by ID with all relationships
 * Applies publication_mode filtering for non-authenticated users
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if user is authenticated (optional - don't require auth)
    const user = await getUserFromRequest(request);
    const isAuthenticated = user !== null;

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

    // If user is authenticated, return full data
    if (isAuthenticated) {
      return NextResponse.json({
        success: true,
        data: aed,
      });
    }

    // If not authenticated, filter by publication_mode
    const filteredAed = filterAedByPublicationMode(aed as AedFullData);

    if (!filteredAed) {
      return NextResponse.json(
        {
          success: false,
          error: "AED not publicly available",
          message: "This AED is not available for public viewing",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredAed,
      publication_mode: aed.publication_mode,
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

    const { id } = await params;
    const body = await request.json();

    // Extraer deleteImageIds, addImages y rejection_reason del body
    const { deleteImageIds, addImages, rejection_reason, ...updateFields } = body;

    // Verificar si hay cambio de estado
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      select: { status: true, last_verified_at: true },
    });

    if (!currentAed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    const hasStatusChange = updateFields.status && updateFields.status !== currentAed.status;

    // Validar transición de estado usando el state machine
    if (hasStatusChange) {
      try {
        validateStatusTransition(currentAed.status, updateFields.status);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Transición de estado inválida" },
          { status: 400 }
        );
      }
    }
    const hasImageChanges =
      (deleteImageIds && deleteImageIds.length > 0) || (addImages && addImages.length > 0);

    // Allowlist of fields non-admin users can update
    const allowedFields = [
      "name",
      "establishment_type",
      "status",
      "description",
      "accessibility",
      "indoor",
      "floor_info",
      "access_info",
      "phone",
      "notes",
      "publication_mode",
    ] as const;
    const updateData: Record<string, unknown> = {
      updated_by: user.userId,
      updated_at: new Date(),
    };
    for (const field of allowedFields) {
      if (field in updateFields) {
        updateData[field] = updateFields[field];
      }
    }

    // Si cambia a PUBLISHED, establecer published_at
    if (
      hasStatusChange &&
      body.status === "PUBLISHED" &&
      !currentAed.status.includes("PUBLISHED")
    ) {
      updateData.published_at = new Date();
    }

    // When images change on an already-verified DEA, refresh the verification date
    if (hasImageChanges && currentAed.last_verified_at) {
      updateData.last_verified_at = new Date();
      updateData.verification_method = "photo_verification";
    }

    // Usar transacción si hay cambio de estado o cambio de imágenes
    if (hasStatusChange || hasImageChanges) {
      const result = await prisma.$transaction(async (tx) => {
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
          // Validar que todas las imágenes tengan tipo asignado
          const imagesWithoutType = addImages.filter((img: any) => !img.type);
          if (imagesWithoutType.length > 0) {
            throw new Error(
              "Todas las imágenes deben tener un tipo asignado. Por favor, selecciona el tipo para cada imagen."
            );
          }

          // Validar que los tipos sean válidos según el enum
          const validTypes = ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"];
          const invalidImages = addImages.filter((img: any) => !validTypes.includes(img.type));
          if (invalidImages.length > 0) {
            throw new Error(
              `Tipo de imagen inválido. Los tipos válidos son: ${validTypes.join(", ")}`
            );
          }

          await tx.aedImage.createMany({
            data: addImages.map((img: any) => ({
              aed_id: id,
              original_url: img.original_url,
              type: img.type,
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
              reason: updateFields.status_metadata?.reason || rejection_reason || null,
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
