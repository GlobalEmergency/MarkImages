/**
 * Admin API for managing organization members
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface AddMemberRequest {
  user_id: string;
  role: "OWNER" | "ADMIN" | "VERIFIER" | "MEMBER" | "VIEWER";
  can_verify?: boolean;
  can_edit?: boolean;
  can_approve?: boolean;
  can_manage_members?: boolean;
  notes?: string;
}

/**
 * GET /api/admin/organizations/[id]/members
 * List all members of an organization
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

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get all members
    const members = await prisma.organizationMember.findMany({
      where: { organization_id: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            is_active: true,
          },
        },
      },
      orderBy: {
        joined_at: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        organization,
        members,
      },
    });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch organization members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations/[id]/members
 * Add a user to an organization
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id: organizationId } = await params;
    const body: AddMemberRequest = await request.json();

    // Validate required fields
    if (!body.user_id || !body.role) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: user_id, role" },
        { status: 400 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: body.user_id },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: body.user_id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: `User '${user.email}' is already a member of this organization` },
        { status: 409 }
      );
    }

    // Set default permissions based on role
    const permissions = {
      can_verify:
        body.can_verify ??
        (body.role === "VERIFIER" || body.role === "ADMIN" || body.role === "OWNER"),
      can_edit: body.can_edit ?? (body.role === "ADMIN" || body.role === "OWNER"),
      can_approve: body.can_approve ?? (body.role === "ADMIN" || body.role === "OWNER"),
      can_manage_members: body.can_manage_members ?? body.role === "OWNER",
    };

    // Create member
    const member = await prisma.organizationMember.create({
      data: {
        organization_id: organizationId,
        user_id: body.user_id,
        role: body.role,
        ...permissions,
        notes: body.notes,
        added_by: admin.userId,
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

    return NextResponse.json(
      {
        success: true,
        data: member,
        message: `User '${user.email}' added to organization '${organization.name}' as ${body.role}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding organization member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add organization member" },
      { status: 500 }
    );
  }
}
