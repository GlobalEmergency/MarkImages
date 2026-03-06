/**
 * Admin API for managing individual organization members
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface UpdateMemberRequest {
  role?: "OWNER" | "ADMIN" | "VERIFIER" | "MEMBER" | "VIEWER";
  can_verify?: boolean;
  can_edit?: boolean;
  can_approve?: boolean;
  can_manage_members?: boolean;
  notes?: string;
}

/**
 * GET /api/admin/organizations/[id]/members/[memberId]
 * Get member details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  await requireAdmin(request);

  try {
    const { id: organizationId, memberId } = await params;

    const member = await prisma.organizationMember.findUnique({
      where: {
        id: memberId,
        organization_id: organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            is_active: true,
            last_login_at: true,
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

    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("Error fetching organization member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch organization member" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]/members/[memberId]
 * Update member role and permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const admin = await requireAdmin(request);

  try {
    const { id: organizationId, memberId } = await params;
    const body: UpdateMemberRequest = await request.json();

    // Check if member exists
    const existing = await prisma.organizationMember.findUnique({
      where: {
        id: memberId,
        organization_id: organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
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

    if (!existing) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {
      updated_by: admin.userId,
    };

    if (body.role !== undefined) updateData.role = body.role;
    if (body.can_verify !== undefined) updateData.can_verify = body.can_verify;
    if (body.can_edit !== undefined) updateData.can_edit = body.can_edit;
    if (body.can_approve !== undefined) updateData.can_approve = body.can_approve;
    if (body.can_manage_members !== undefined)
      updateData.can_manage_members = body.can_manage_members;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update member
    const member = await prisma.organizationMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: member,
      message: `Member '${existing.user.email}' updated successfully`,
    });
  } catch (error) {
    console.error("Error updating organization member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update organization member" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/members/[memberId]
 * Remove a member from an organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  await requireAdmin(request);

  try {
    const { id: organizationId, memberId } = await params;

    // Check if member exists
    const existing = await prisma.organizationMember.findUnique({
      where: {
        id: memberId,
        organization_id: organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
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

    if (!existing) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    // Check if this is the last OWNER
    if (existing.role === "OWNER") {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organization_id: organizationId,
          role: "OWNER",
        },
      });

      if (ownerCount === 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot remove the last OWNER of the organization. Assign another OWNER first.",
          },
          { status: 409 }
        );
      }
    }

    // Delete member
    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      success: true,
      message: `Member '${existing.user.email}' removed from organization '${existing.organization.name}'`,
    });
  } catch (error) {
    console.error("Error removing organization member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove organization member" },
      { status: 500 }
    );
  }
}
