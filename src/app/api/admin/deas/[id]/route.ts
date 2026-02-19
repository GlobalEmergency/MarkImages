/**
 * Admin API Route: /api/admin/deas/[id]
 * Full DEA detail with all relationships for administrative purposes
 * Requires ADMIN authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";

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

// ── Helpers for field-change tracking ──────────────────────────────────

type FieldChangeRecord = {
  aed_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  change_source: "WEB_UI";
};

/** Safely stringify a value for audit comparison */
function auditStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/** Compare current vs new and create field change record if different */
function trackChange(
  changes: FieldChangeRecord[],
  aedId: string,
  userId: string,
  fieldName: string,
  oldVal: unknown,
  newVal: unknown
) {
  const oldStr = auditStr(oldVal);
  const newStr = auditStr(newVal);
  if (oldStr !== newStr) {
    changes.push({
      aed_id: aedId,
      field_name: fieldName,
      old_value: oldStr,
      new_value: newStr,
      changed_by: userId,
      change_source: "WEB_UI",
    });
  }
}

/** Track changes for a flat object with a prefix (e.g. "location.street_name") */
function trackNestedChanges(
  changes: FieldChangeRecord[],
  aedId: string,
  userId: string,
  prefix: string,
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
) {
  for (const key of Object.keys(incoming)) {
    trackChange(changes, aedId, userId, `${prefix}.${key}`, current[key], incoming[key]);
  }
}

/**
 * PATCH /api/admin/deas/[id]
 * Update DEA information (admin version with full access)
 * Supports: top-level fields, location, schedule, responsible, images (add/delete)
 * All changes are recorded in AedFieldChange for audit trail
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

    // Separate nested objects from top-level fields
    const {
      deleteImageIds,
      addImages, // Array of { url: string (data: URL or blob), type: string, order: number }
      location: locationUpdate,
      schedule: scheduleUpdate,
      responsible: responsibleUpdate,
      // Fields we should never pass to prisma.aed.update
      id: _ignoreId,
      created_at: _ignoreCreatedAt,
      updated_at: _ignoreUpdatedAt,
      images: _ignoreImages,
      status_changes: _ignoreStatusChanges,
      publication_history: _ignorePubHistory,
      field_changes: _ignoreFieldChanges,
      validations: _ignoreValidations,
      assignments: _ignoreAssignments,
      org_verifications: _ignoreOrgVerifications,
      change_proposals: _ignoreChangeProposals,
      ownership_claims: _ignoreOwnershipClaims,
      batch_job: _ignoreBatchJob,
      data_source: _ignoreDataSource,
      ...aedUpdateFields
    } = body;

    // Fetch current state for comparison
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: true,
        schedule: true,
        responsible: true,
        images: true,
      },
    });

    if (!currentAed) {
      return NextResponse.json(
        { success: false, error: "AED not found" },
        { status: 404 }
      );
    }

    const fieldChanges: FieldChangeRecord[] = [];

    // ── Track AED-level field changes ──
    const aedFields = [
      "name", "code", "provisional_number", "establishment_type",
      "status", "publication_mode", "is_publicly_accessible",
      "public_notes", "rejection_reason", "requires_attention",
      "installation_date", "latitude", "longitude", "coordinates_precision",
    ];

    for (const key of aedFields) {
      if (key in aedUpdateFields) {
        trackChange(
          fieldChanges,
          id,
          user.userId,
          key,
          currentAed[key as keyof typeof currentAed],
          aedUpdateFields[key]
        );
      }
    }

    // ── Track location changes ──
    if (locationUpdate && currentAed.location) {
      trackNestedChanges(
        fieldChanges,
        id,
        user.userId,
        "location",
        currentAed.location as unknown as Record<string, unknown>,
        locationUpdate
      );
    }

    // ── Track schedule changes ──
    if (scheduleUpdate) {
      const currentSchedule = (currentAed.schedule || {}) as Record<string, unknown>;
      trackNestedChanges(fieldChanges, id, user.userId, "schedule", currentSchedule, scheduleUpdate);
    }

    // ── Track responsible changes ──
    if (responsibleUpdate) {
      const currentResponsible = (currentAed.responsible || {}) as Record<string, unknown>;
      trackNestedChanges(fieldChanges, id, user.userId, "responsible", currentResponsible, responsibleUpdate);
    }

    // ── Track image deletions ──
    if (deleteImageIds && deleteImageIds.length > 0) {
      const imagesToDelete = currentAed.images.filter((img) =>
        deleteImageIds.includes(img.id)
      );
      imagesToDelete.forEach((img) => {
        fieldChanges.push({
          aed_id: id,
          field_name: "image_deleted",
          old_value: `${img.type} - ${img.original_url}`,
          new_value: "(eliminada)",
          changed_by: user.userId,
          change_source: "WEB_UI",
        });
      });
    }

    // ── Track image additions ──
    if (addImages && addImages.length > 0) {
      addImages.forEach((img: { type: string }) => {
        fieldChanges.push({
          aed_id: id,
          field_name: "image_added",
          old_value: "",
          new_value: `${img.type}`,
          changed_by: user.userId,
          change_source: "WEB_UI",
        });
      });
    }

    // Detect status changes for history
    const hasStatusChange = aedUpdateFields.status && aedUpdateFields.status !== currentAed.status;
    const hasImageChanges =
      (deleteImageIds && deleteImageIds.length > 0) || (addImages && addImages.length > 0);

    // ── Execute all updates in a transaction ──
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete images
      if (deleteImageIds && deleteImageIds.length > 0) {
        await tx.aedImage.deleteMany({
          where: {
            id: { in: deleteImageIds },
            aed_id: id,
          },
        });
      }

      // 2. Add new images (upload base64 to S3)
      if (addImages && addImages.length > 0) {
        for (const img of addImages as Array<{ url: string; type: string; order: number }>) {
          const validTypes = ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"];
          if (!validTypes.includes(img.type)) {
            throw new Error(`Tipo de imagen inválido: ${img.type}`);
          }

          let originalUrl = img.url;

          // If it's a data: URL or blob, upload to S3
          if (img.url.startsWith("data:")) {
            const matches = img.url.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) throw new Error("Formato de imagen inválido");
            const contentType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, "base64");
            const ext = contentType.includes("png") ? "png" : "jpg";

            originalUrl = await uploadToS3({
              buffer,
              filename: `admin_upload.${ext}`,
              contentType,
              prefix: id,
            });
          }

          await tx.aedImage.create({
            data: {
              aed_id: id,
              original_url: originalUrl,
              type: img.type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
              order: img.order || 1,
              created_at: new Date(),
            },
          });
        }
      }

      // 3. Update location if provided
      if (locationUpdate && currentAed.location) {
        // Filter out non-schema fields
        const { id: _locId, created_at: _locCreated, aed: _locAed, address_validation: _locAV, ...cleanLocation } = locationUpdate;
        await tx.aedLocation.update({
          where: { id: currentAed.location.id },
          data: {
            ...cleanLocation,
            updated_at: new Date(),
          },
        });
      }

      // 4. Update or create schedule
      if (scheduleUpdate) {
        const { id: _schedId, created_at: _schedCreated, aed: _schedAed, ...cleanSchedule } = scheduleUpdate;
        if (currentAed.schedule) {
          await tx.aedSchedule.update({
            where: { id: currentAed.schedule.id },
            data: {
              ...cleanSchedule,
              updated_at: new Date(),
            },
          });
        } else {
          // Create new schedule and link to AED
          const newSchedule = await tx.aedSchedule.create({
            data: {
              ...cleanSchedule,
            },
          });
          await tx.aed.update({
            where: { id },
            data: { schedule_id: newSchedule.id },
          });
        }
      }

      // 5. Update or create responsible
      if (responsibleUpdate) {
        const { id: _respId, created_at: _respCreated, aeds: _respAeds, ...cleanResponsible } = responsibleUpdate;
        if (currentAed.responsible) {
          await tx.aedResponsible.update({
            where: { id: currentAed.responsible.id },
            data: {
              ...cleanResponsible,
              updated_at: new Date(),
            },
          });
        } else if (cleanResponsible.name) {
          // Create new responsible — name is required
          const newResponsible = await tx.aedResponsible.create({
            data: {
              name: cleanResponsible.name,
              ...cleanResponsible,
            },
          });
          await tx.aed.update({
            where: { id },
            data: { responsible_id: newResponsible.id },
          });
        }
      }

      // 6. Build AED update data (only schema-valid fields)
      const validAedFields: Record<string, unknown> = {};
      const allowedAedFields = [
        "name", "code", "provisional_number", "establishment_type",
        "status", "publication_mode", "is_publicly_accessible",
        "public_notes", "internal_notes", "rejection_reason", "requires_attention",
        "installation_date", "latitude", "longitude", "coordinates_precision",
        "source_origin", "source_details", "external_reference",
        "verification_method",
      ];

      for (const key of allowedAedFields) {
        if (key in aedUpdateFields) {
          validAedFields[key] = aedUpdateFields[key];
        }
      }

      // When images change on verified DEA, refresh verification date
      if (hasImageChanges && currentAed.last_verified_at) {
        validAedFields.last_verified_at = new Date();
        validAedFields.verification_method = "photo_verification";
      }

      // Update AED record
      const updatedAed = await tx.aed.update({
        where: { id },
        data: {
          ...validAedFields,
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

      // 7. Record status change in history
      if (hasStatusChange) {
        await tx.aedStatusChange.create({
          data: {
            aed_id: id,
            previous_status: currentAed.status,
            new_status: aedUpdateFields.status,
            reason: "Cambio desde panel de administración",
            modified_by: user.userId,
          },
        });
      }

      // 8. Record all field changes
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
      images_added: addImages?.length || 0,
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
