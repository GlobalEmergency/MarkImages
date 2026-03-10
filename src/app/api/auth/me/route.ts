import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/jwt";
import type { UserPublic, UserPermissions, UserOrganization } from "@/types";

export async function GET() {
  try {
    // Get current user from JWT
    const jwtPayload = await getCurrentUser();

    if (!jwtPayload) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get full user data from database
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
        created_at: true,
        last_login_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "Cuenta desactivada" }, { status: 403 });
    }

    // Calculate permissions
    const isAdmin = user.role === "ADMIN";
    const isModerator = user.role === "MODERATOR";

    // Get user's organization memberships
    const orgMemberships = await prisma.organizationMember.findMany({
      where: { user_id: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Map organizations with permissions
    const organizations: UserOrganization[] = orgMemberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
      role: m.role,
      permissions: {
        can_verify: m.can_verify,
        can_edit: m.can_edit,
        can_approve: m.can_approve,
        can_manage_members: m.can_manage_members,
      },
    }));

    // Calculate aggregated permissions from organizations
    const canVerifyFromOrg = orgMemberships.some((m) => m.can_verify);
    const canEditFromOrg = orgMemberships.some((m) => m.can_edit);
    const canApproveFromOrg = orgMemberships.some((m) => m.can_approve);

    // Check ownership of DEAs
    const ownedAedsCount = await prisma.aed.count({
      where: { owner_user_id: user.id },
    });

    // Build complete permissions object
    const permissions: UserPermissions = {
      // Global roles
      isAdmin,
      isModerator,

      // General permissions
      canAccessAdmin: isAdmin,
      canManageUsers: isAdmin,
      canManageOrganizations: isAdmin || isModerator,
      canViewAllAeds: isAdmin,
      canEditAllAeds: isAdmin,

      // Verification permissions
      canVerify: isAdmin || canVerifyFromOrg,
      canApprovePublications: isAdmin || canApproveFromOrg,

      // Import/Export permissions
      canImportAeds: isAdmin || isModerator || canEditFromOrg,
      canExportAeds: isAdmin || isModerator || canVerifyFromOrg,

      // Owner permissions
      isOwner: ownedAedsCount > 0,
      ownedAedsCount,

      // Organizations
      organizations,
      hasOrganizations: organizations.length > 0,
    };

    const userPublic: UserPublic = {
      ...user,
      permissions,
    };

    return NextResponse.json({ user: userPublic });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}
