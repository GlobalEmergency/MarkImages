/**
 * Admin API for managing individual organizations
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { UpdateOrganizationRequest } from "@/types/organization";

/**
 * GET /api/admin/organizations/[id]
 * Get organization details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        parent_org: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        child_orgs: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        aed_assignments: {
          where: { status: "ACTIVE" },
          include: {
            aed: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
          },
        },
        verifications: {
          where: { is_current: true },
          include: {
            aed: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            aed_assignments: true,
            verifications: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch organization",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]
 * Update organization
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body: UpdateOrganizationRequest = await request.json();

    // Check if organization exists
    const existing = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if code is being changed and if it's already in use
    if (body.code && body.code !== existing.code) {
      const codeInUse = await prisma.organization.findUnique({
        where: { code: body.code },
      });

      if (codeInUse) {
        return NextResponse.json(
          { success: false, error: `Organization with code '${body.code}' already exists` },
          { status: 409 }
        );
      }
    }

    // Build update data (only include provided fields)
    const updateData: any = {
      updated_by: admin.userId,
    };

    if (body.type !== undefined) updateData.type = body.type;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.scope_type !== undefined) updateData.scope_type = body.scope_type;
    if (body.city_code !== undefined) updateData.city_code = body.city_code;
    if (body.city_name !== undefined) updateData.city_name = body.city_name;
    if (body.district_codes !== undefined) updateData.district_codes = body.district_codes;
    if (body.custom_scope_description !== undefined)
      updateData.custom_scope_description = body.custom_scope_description;
    if (body.require_approval !== undefined) updateData.require_approval = body.require_approval;
    if (body.approval_authority !== undefined)
      updateData.approval_authority = body.approval_authority;
    if (body.badge_name !== undefined) updateData.badge_name = body.badge_name;
    if (body.badge_icon !== undefined) updateData.badge_icon = body.badge_icon;
    if (body.badge_color !== undefined) updateData.badge_color = body.badge_color;
    if (body.parent_org_id !== undefined) updateData.parent_org_id = body.parent_org_id;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Update organization
    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: {
        parent_org: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: organization,
      message: `Organization '${organization.name}' updated successfully`,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update organization",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]
 * Delete (deactivate) organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Check if organization exists
    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            aed_assignments: { where: { status: "ACTIVE" } },
            child_orgs: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if organization has active assignments or members
    if (
      existing._count.aed_assignments > 0 ||
      existing._count.members > 0 ||
      existing._count.child_orgs > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete organization with active assignments, members, or child organizations. Deactivate it instead.",
          details: {
            active_assignments: existing._count.aed_assignments,
            members: existing._count.members,
            child_orgs: existing._count.child_orgs,
          },
        },
        { status: 409 }
      );
    }

    // If no dependencies, soft delete by deactivating
    const organization = await prisma.organization.update({
      where: { id },
      data: {
        is_active: false,
        updated_by: admin.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: organization,
      message: `Organization '${organization.name}' deactivated successfully`,
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete organization",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
