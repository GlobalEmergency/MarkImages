/**
 * Admin API Route: /api/admin/deas/[id]
 * Full DEA detail with all relationships for administrative purposes
 * Requires ADMIN authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/deas/[id]
 * Get complete DEA information including all relationships and history
 * Only accessible by ADMIN users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require ADMIN authentication
    const user = await requireAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Fetch AED with ALL relationships
    const aed = await prisma.aed.findUnique({
      where: { id },
      include: {
        // Core relationships
        location: {
          include: {
            address_validation: true,
          },
        },
        responsible: true,
        schedule: true,

        // Images with markers
        images: {
          include: {
            markers: true,
          },
          orderBy: {
            order: "asc",
          },
        },

        // History and audit
        status_changes: {
          orderBy: {
            created_at: "desc",
          },
          take: 50,
        },
        publication_history: {
          orderBy: {
            created_at: "desc",
          },
          take: 50,
        },
        code_history: {
          orderBy: {
            assigned_at: "desc",
          },
        },
        field_changes: {
          orderBy: {
            changed_at: "desc",
          },
          take: 100,
        },

        // Validations
        validations: {
          include: {
            sessions: true,
          },
          orderBy: {
            started_at: "desc",
          },
          take: 20,
        },

        // Organizations
        assignments: {
          include: {
            organization: true,
          },
          orderBy: {
            assigned_at: "desc",
          },
        },
        org_verifications: {
          include: {
            organization: true,
          },
          orderBy: {
            verified_at: "desc",
          },
          take: 20,
        },

        // Proposals and claims
        change_proposals: {
          orderBy: {
            proposed_at: "desc",
          },
          take: 20,
        },
        ownership_claims: {
          orderBy: {
            created_at: "desc",
          },
          take: 20,
        },

        // Batch job reference
        batch_job: true,
        data_source: true,
      },
    });

    if (!aed) {
      return NextResponse.json(
        {
          success: false,
          error: "AED not found",
        },
        { status: 404 }
      );
    }

    // Get counts for summary
    const counts = {
      images: aed.images.length,
      verified_images: aed.images.filter((img) => img.is_verified).length,
      status_changes: await prisma.aedStatusChange.count({
        where: { aed_id: id },
      }),
      field_changes: await prisma.aedFieldChange.count({
        where: { aed_id: id },
      }),
      validations: await prisma.aedValidation.count({
        where: { aed_id: id },
      }),
      active_assignments: aed.assignments.filter((a) => a.status === "ACTIVE").length,
      verifications: aed.org_verifications.length + aed.validations.length,
      pending_proposals: aed.change_proposals.filter((p) => p.status === "PENDING").length,
      pending_claims: aed.ownership_claims.filter((c) => c.status === "PENDING").length,
    };

    return NextResponse.json({
      success: true,
      data: aed,
      counts,
      metadata: {
        fetched_at: new Date().toISOString(),
        fetched_by: user.userId,
      },
    });
  } catch (error) {
    console.error("Error fetching admin AED detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AED details",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/deas/[id]
 * Update DEA information (admin version with full access)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Extract deleteImageIds from body before processing
    const { deleteImageIds, ...updateFields } = body;

    // Track field changes for audit
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: true,
        schedule: true,
        responsible: true,
        images: true, // Include images to audit deletions
      },
    });

    if (!currentAed) {
      return NextResponse.json(
        { success: false, error: "AED not found" },
        { status: 404 }
      );
    }

    const fieldChanges: any[] = [];

    // Detect changes and create audit records (excluding special fields)
    Object.keys(updateFields).forEach((key) => {
      if (
        key !== "location" &&
        key !== "schedule" &&
        key !== "responsible" &&
        key !== "deleteImageIds" &&
        currentAed[key as keyof typeof currentAed] !== updateFields[key]
      ) {
        fieldChanges.push({
          aed_id: id,
          field_name: key,
          old_value: String(currentAed[key as keyof typeof currentAed] || ""),
          new_value: String(updateFields[key] || ""),
          changed_by: user.userId,
          change_source: "WEB_UI",
        });
      }
    });

    // Audit image deletions
    if (deleteImageIds && deleteImageIds.length > 0) {
      const imagesToDelete = currentAed.images.filter((img) =>
        deleteImageIds.includes(img.id)
      );

      imagesToDelete.forEach((img) => {
        fieldChanges.push({
          aed_id: id,
          field_name: `image_deleted`,
          old_value: `${img.type} - ${img.original_url}`,
          new_value: "(deleted)",
          changed_by: user.userId,
          change_source: "WEB_UI",
        });
      });
    }

    // Detect image changes for verification date refresh
    const hasImageChanges = deleteImageIds && deleteImageIds.length > 0;

    // Update in transaction with audit trail
    const result = await prisma.$transaction(async (tx) => {
      // Delete images if specified (S3 files remain, only DB records are deleted)
      if (deleteImageIds && deleteImageIds.length > 0) {
        await tx.aedImage.deleteMany({
          where: {
            id: { in: deleteImageIds },
            aed_id: id, // Security: only delete images from this AED
          },
        });
      }

      // When images change on an already-verified DEA, refresh the verification date
      const verificationRefresh =
        hasImageChanges && currentAed.last_verified_at
          ? { last_verified_at: new Date(), verification_method: "photo_verification" }
          : {};

      // Update AED (without deleteImageIds in data)
      const updatedAed = await tx.aed.update({
        where: { id },
        data: {
          ...updateFields,
          ...verificationRefresh,
          updated_by: user.userId,
          updated_at: new Date(),
        },
        include: {
          location: true,
          schedule: true,
          responsible: true,
          images: {
            orderBy: { order: "asc" },
          },
        },
      });

      // Create field change records (including image deletions)
      if (fieldChanges.length > 0) {
        await tx.aedFieldChange.createMany({
          data: fieldChanges,
        });
      }

      return updatedAed;
    });

    return NextResponse.json({
      success: true,
      data: result,
      changes_recorded: fieldChanges.length,
      images_deleted: deleteImageIds?.length || 0,
    });
  } catch (error) {
    console.error("Error updating AED:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update AED",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
