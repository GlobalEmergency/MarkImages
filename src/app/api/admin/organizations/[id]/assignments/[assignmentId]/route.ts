/**
 * Admin API for managing a specific AED assignment
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/organizations/[id]/assignments/[assignmentId]
 * Get a specific assignment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  await requireAdmin(request);

  const { id, assignmentId } = await params;

  try {
    const assignment = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        id: assignmentId,
        organization_id: id,
      },
      include: {
        aed: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            location: {
              select: {
                street_name: true,
                street_number: true,
                city_name: true,
              },
            },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch assignment",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]/assignments/[assignmentId]
 * Update an assignment (status, publication mode, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const admin = await requireAdmin(request);

  const { id, assignmentId } = await params;

  try {
    const body = await request.json();
    const {
      status,
      publication_mode,
      approved_for_full,
      approved_by_authority,
      approval_notes,
      revoked_reason,
    } = body;

    // Check if assignment exists
    const existingAssignment = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        id: assignmentId,
        organization_id: id,
      },
    });

    if (!existingAssignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;

      // If revoking, set revoked fields
      if (status === "REVOKED") {
        updateData.revoked_at = new Date();
        updateData.revoked_by = admin.userId;
        if (revoked_reason) {
          updateData.revoked_reason = revoked_reason;
        }
      }
    }

    if (publication_mode !== undefined) updateData.publication_mode = publication_mode;
    if (approved_for_full !== undefined) updateData.approved_for_full = approved_for_full;
    if (approved_by_authority !== undefined)
      updateData.approved_by_authority = approved_by_authority;
    if (approval_notes !== undefined) updateData.approval_notes = approval_notes;

    const assignment = await prisma.aedOrganizationAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        aed: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error("Error updating assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update assignment",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/assignments/[assignmentId]
 * Revoke an assignment (soft delete - sets status to REVOKED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const admin = await requireAdmin(request);

  const { id, assignmentId } = await params;

  try {
    // Check if assignment exists
    const existingAssignment = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        id: assignmentId,
        organization_id: id,
      },
      include: {
        aed: {
          select: { name: true },
        },
        organization: {
          select: { name: true },
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Soft delete - set status to REVOKED
    await prisma.aedOrganizationAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "REVOKED",
        revoked_at: new Date(),
        revoked_by: admin.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Assignment for ${existingAssignment.aed.name} from ${existingAssignment.organization.name} has been revoked`,
    });
  } catch (error) {
    console.error("Error revoking assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to revoke assignment",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
