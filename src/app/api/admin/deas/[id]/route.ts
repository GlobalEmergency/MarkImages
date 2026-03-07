/**
 * Admin API Route: /api/admin/deas/[id]
 * Full DEA detail with all relationships for administrative purposes
 * Requires ADMIN authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrAedPermission, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { validateStatusTransition } from "@/lib/aed-status";
import { recordStatusChange } from "@/lib/audit";

/**
 * GET /api/admin/deas/[id]
 * Get complete DEA information including all relationships and history
 * Only accessible by ADMIN users
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Require ADMIN role or org-level can_view permission for this AED
    const { user } = await requireAdminOrAedPermission(request, id, "can_view");

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

    // Get counts for summary (parallel queries for performance)
    const [statusChangesCount, fieldChangesCount, validationsCount] = await Promise.all([
      prisma.aedStatusChange.count({ where: { aed_id: id } }),
      prisma.aedFieldChange.count({ where: { aed_id: id } }),
      prisma.aedValidation.count({ where: { aed_id: id } }),
    ]);

    const counts = {
      images: aed.images.length,
      verified_images: aed.images.filter((img) => img.is_verified).length,
      status_changes: statusChangesCount,
      field_changes: fieldChangesCount,
      validations: validationsCount,
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
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

// ── AED Field Allowlist (single source of truth) ──────────────────────
// Fields that can be updated AND tracked in the audit trail.
// Additional admin-only fields that are updatable but NOT individually
// tracked in field changes are listed separately below.
const TRACKABLE_AED_FIELDS = [
  "name",
  "code",
  "provisional_number",
  "establishment_type",
  "status",
  "publication_mode",
  "is_publicly_accessible",
  "public_notes",
  "rejection_reason",
  "requires_attention",
  "installation_date",
  "latitude",
  "longitude",
  "coordinates_precision",
  "source_origin",
  "source_details",
  "external_reference",
  "verification_method",
] as const;

// Fields that are updatable but NOT individually tracked (bulk/metadata fields)
const UNTRACKED_AED_FIELDS = ["internal_notes"] as const;

// All fields allowed in prisma.aed.update
const ALLOWED_AED_FIELDS: readonly string[] = [...TRACKABLE_AED_FIELDS, ...UNTRACKED_AED_FIELDS];

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
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireAdminOrAedPermission(request, id, "can_edit");
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
      return NextResponse.json({ success: false, error: "AED not found" }, { status: 404 });
    }

    const fieldChanges: FieldChangeRecord[] = [];

    // ── Track AED-level field changes ──
    for (const key of TRACKABLE_AED_FIELDS) {
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
      trackNestedChanges(
        fieldChanges,
        id,
        user.userId,
        "schedule",
        currentSchedule,
        scheduleUpdate
      );
    }

    // ── Track responsible changes ──
    if (responsibleUpdate) {
      const currentResponsible = (currentAed.responsible || {}) as Record<string, unknown>;
      trackNestedChanges(
        fieldChanges,
        id,
        user.userId,
        "responsible",
        currentResponsible,
        responsibleUpdate
      );
    }

    // ── Track image deletions ──
    if (deleteImageIds && deleteImageIds.length > 0) {
      const imagesToDelete = currentAed.images.filter((img) => deleteImageIds.includes(img.id));
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

    // Validate status transition before proceeding
    if (aedUpdateFields.status && aedUpdateFields.status !== currentAed.status) {
      try {
        validateStatusTransition(currentAed.status, aedUpdateFields.status);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : "Transición inválida" },
          { status: 400 }
        );
      }
    }

    // Detect status changes for history
    const hasStatusChange = aedUpdateFields.status && aedUpdateFields.status !== currentAed.status;
    const hasImageChanges =
      (deleteImageIds && deleteImageIds.length > 0) || (addImages && addImages.length > 0);

    // ── Pre-process: upload images to S3 OUTSIDE the transaction ──
    // Network I/O (S3) must not hold open a DB transaction connection.
    const resolvedImages: Array<{ url: string; type: string; order: number }> = [];
    if (addImages && addImages.length > 0) {
      for (const img of addImages as Array<{ url: string; type: string; order: number }>) {
        const validTypes = ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"];
        if (!validTypes.includes(img.type)) {
          return NextResponse.json(
            { success: false, error: `Tipo de imagen inválido: ${img.type}` },
            { status: 400 }
          );
        }

        let originalUrl = img.url;

        if (img.url.startsWith("data:")) {
          const matches = img.url.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            return NextResponse.json(
              { success: false, error: "Formato de imagen inválido" },
              { status: 400 }
            );
          }
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

        resolvedImages.push({ url: originalUrl, type: img.type, order: img.order || 1 });
      }
    }

    // ── Execute all DB writes in a transaction ──
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

      // 2. Create image records (URLs already resolved from S3)
      for (const img of resolvedImages) {
        await tx.aedImage.create({
          data: {
            aed_id: id,
            original_url: img.url,
            type: img.type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
            order: img.order,
            created_at: new Date(),
          },
        });
      }

      // 3. Update location if provided
      if (locationUpdate && currentAed.location) {
        // Filter out non-schema fields
        const {
          id: _locId,
          created_at: _locCreated,
          aed: _locAed,
          address_validation: _locAV,
          ...cleanLocation
        } = locationUpdate;
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
        const {
          id: _schedId,
          created_at: _schedCreated,
          aed: _schedAed,
          ...cleanSchedule
        } = scheduleUpdate;
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
        const {
          id: _respId,
          created_at: _respCreated,
          aeds: _respAeds,
          ...cleanResponsible
        } = responsibleUpdate;
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

      for (const key of ALLOWED_AED_FIELDS) {
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
        await recordStatusChange(tx, {
          aedId: id,
          previousStatus: currentAed.status,
          newStatus: aedUpdateFields.status,
          modifiedBy: user.userId,
          reason: "Cambio desde panel de administración",
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
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

/**
 * DELETE /api/admin/deas/[id]
 * Permanently delete an AED and all its related records.
 * Accessible by global admins and org members with can_edit permission.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdminOrAedPermission(request, id, "can_edit");

    // Fetch AED with FK references to clean up orphans
    const aed = await prisma.aed.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        location_id: true,
        schedule_id: true,
        responsible_id: true,
      },
    });

    if (!aed) {
      return NextResponse.json({ success: false, error: "DEA no encontrado" }, { status: 404 });
    }

    // Optional reason from body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch {
      // No body or invalid JSON — that's fine
    }

    console.log(
      `🗑️ Admin deleting AED ${id} (${aed.code || aed.name}). Status: ${aed.status}. Reason: ${reason || "N/A"}`
    );

    // Delete AED in a transaction. Cascade handles most relations.
    // Then clean up orphaned location/schedule (they don't cascade).
    await prisma.$transaction(async (tx) => {
      // 1. Delete the AED (cascades to images, validations, status_changes, etc.)
      await tx.aed.delete({ where: { id } });

      // 2. Clean up orphaned location (if no other AED references it)
      if (aed.location_id) {
        const locationRefCount = await tx.aed.count({
          where: { location_id: aed.location_id },
        });
        if (locationRefCount === 0) {
          await tx.aedLocation.delete({ where: { id: aed.location_id } });
        }
      }

      // 3. Clean up orphaned schedule (if no other AED references it)
      if (aed.schedule_id) {
        const scheduleRefCount = await tx.aed.count({
          where: { schedule_id: aed.schedule_id },
        });
        if (scheduleRefCount === 0) {
          await tx.aedSchedule.delete({ where: { id: aed.schedule_id } });
        }
      }

      // Note: responsible_id is NOT cleaned up — it may be shared across AEDs
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      aed: { id: aed.id, name: aed.name, code: aed.code },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error deleting AED:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al eliminar DEA",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
