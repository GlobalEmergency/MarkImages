/**
 * Organization Permissions Helper
 *
 * Permission checking utilities for the organization system
 */

import { prisma } from "@/lib/db";

/**
 * Check if user can view an AED
 * - Owner can always view
 * - Members of assigned organizations can view
 * - Admins can view
 * - Public DEAs can be viewed by anyone
 */
export async function canUserViewAed(userId: string, aedId: string): Promise<boolean> {
  // Get AED with owner and assignments
  const aed = await prisma.aed.findUnique({
    where: { id: aedId },
    select: {
      owner_user_id: true,
      publication_mode: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { organization_id: true },
      },
    },
  });

  if (!aed) return false;

  // 1. Is owner?
  if (aed.owner_user_id === userId) return true;

  // 2. Is member of assigned organization?
  if (aed.assignments.length > 0) {
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        user_id: userId,
        organization_id: { in: aed.assignments.map((a) => a.organization_id) },
      },
    });

    if (userOrgs.length > 0) return true;
  }

  // 3. Is public (published)?
  if (aed.publication_mode !== "NONE") return true;

  return false;
}

/**
 * Check if user can edit an AED
 * - Owner can always edit
 * - Members with can_edit permission from assigned organizations
 * - Admins can edit
 */
export async function canUserEditAed(userId: string, aedId: string): Promise<boolean> {
  const aed = await prisma.aed.findUnique({
    where: { id: aedId },
    select: {
      owner_user_id: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { organization_id: true },
      },
    },
  });

  if (!aed) return false;

  // 1. Is owner?
  if (aed.owner_user_id === userId) return true;

  // 2. Is member with can_edit permission?
  if (aed.assignments.length > 0) {
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        user_id: userId,
        organization_id: { in: aed.assignments.map((a) => a.organization_id) },
        can_edit: true,
      },
    });

    if (userOrgs.length > 0) return true;
  }

  return false;
}

/**
 * Check if user can verify an AED
 * - Members with can_verify permission from assigned organizations
 */
export async function canUserVerifyAed(userId: string, aedId: string): Promise<boolean> {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: { organization_id: true },
  });

  if (assignments.length === 0) return false;

  const userOrgs = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      organization_id: { in: assignments.map((a) => a.organization_id) },
      can_verify: true,
    },
  });

  return userOrgs.length > 0;
}

/**
 * Check if user can approve publication for an AED
 * - Members with can_approve permission from assigned organizations
 */
export async function canUserApprovePublication(userId: string, aedId: string): Promise<boolean> {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: { organization_id: true },
  });

  if (assignments.length === 0) return false;

  const userOrgs = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      organization_id: { in: assignments.map((a) => a.organization_id) },
      can_approve: true,
    },
  });

  return userOrgs.length > 0;
}

/**
 * Check if user can manage an organization
 * - Owner or Admin role in the organization
 */
export async function canUserManageOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: organizationId,
        user_id: userId,
      },
    },
    select: { role: true },
  });

  return member?.role === "OWNER" || member?.role === "ADMIN";
}

/**
 * Get user's permissions for a specific AED in a single optimized pass.
 * Uses 2 DB queries instead of 8 (4 functions x 2 queries each).
 */
export async function getUserPermissionsForAed(userId: string, aedId: string) {
  // Query 1: get AED with owner and assignments
  const aed = await prisma.aed.findUnique({
    where: { id: aedId },
    select: {
      owner_user_id: true,
      publication_mode: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { organization_id: true },
      },
    },
  });

  if (!aed) {
    return { can_view: false, can_edit: false, can_verify: false, can_approve: false };
  }

  const isOwner = aed.owner_user_id === userId;
  const isPublic = aed.publication_mode !== "NONE";
  const assignedOrgIds = aed.assignments.map((a) => a.organization_id);

  // No assignments: resolve without another query
  if (assignedOrgIds.length === 0) {
    return {
      can_view: isOwner || isPublic,
      can_edit: isOwner,
      can_verify: false,
      can_approve: false,
    };
  }

  // Query 2: user's memberships in assigned organizations (all permission flags)
  const memberships = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      organization_id: { in: assignedOrgIds },
    },
    select: {
      can_edit: true,
      can_verify: true,
      can_approve: true,
    },
  });

  const isMember = memberships.length > 0;

  return {
    can_view: isOwner || isMember || isPublic,
    can_edit: isOwner || memberships.some((m) => m.can_edit),
    can_verify: memberships.some((m) => m.can_verify),
    can_approve: memberships.some((m) => m.can_approve),
  };
}

/**
 * Get all organizations where user is a member
 */
export async function getUserOrganizations(userId: string) {
  return await prisma.organizationMember.findMany({
    where: { user_id: userId },
    include: {
      organization: true,
    },
  });
}

/**
 * Get AEDs assigned to user's organizations
 */
export async function getAedsForUserOrganizations(
  userId: string,
  filters?: {
    status?: string[];
    organization_id?: string;
  }
) {
  // Get user's organizations
  const userOrgs = await prisma.organizationMember.findMany({
    where: { user_id: userId },
    select: { organization_id: true },
  });

  if (userOrgs.length === 0) return [];

  const orgIds = filters?.organization_id
    ? [filters.organization_id]
    : userOrgs.map((o) => o.organization_id);

  // Get AEDs assigned to these organizations
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      organization_id: { in: orgIds },
      status: filters?.status ? { in: filters.status as any } : undefined,
    },
    include: {
      aed: {
        include: {
          location: true,
        },
      },
      organization: true,
    },
  });

  return assignments;
}

/**
 * Assignment types that only allow ONE active assignment per AED.
 * Other types (CERTIFIED_COMPANY, VERIFICATION) allow multiple.
 */
const SINGLE_ASSIGNMENT_TYPES = ["CIVIL_PROTECTION", "OWNERSHIP", "MAINTENANCE"];

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  CIVIL_PROTECTION: "Protección Civil",
  OWNERSHIP: "Propietario",
  MAINTENANCE: "Mantenedor",
};

/**
 * Check if an assignment would conflict with existing assignments.
 * CIVIL_PROTECTION, OWNERSHIP, and MAINTENANCE only allow ONE active per AED.
 */
export async function checkAssignmentConflict(
  aedId: string,
  assignmentType: string,
  organizationId: string
): Promise<{
  hasConflict: boolean;
  conflictMessage?: string;
}> {
  if (!SINGLE_ASSIGNMENT_TYPES.includes(assignmentType)) {
    return { hasConflict: false };
  }

  const existing = await prisma.aedOrganizationAssignment.findFirst({
    where: {
      aed_id: aedId,
      assignment_type: assignmentType as any,
      status: "ACTIVE",
    },
    include: {
      organization: true,
    },
  });

  if (existing && existing.organization_id !== organizationId) {
    const label = ASSIGNMENT_TYPE_LABELS[assignmentType] || assignmentType;
    return {
      hasConflict: true,
      conflictMessage: `Este DEA ya está asignado a ${existing.organization.name} como ${label}. Debe revocarse esa asignación primero.`,
    };
  }

  return { hasConflict: false };
}

/**
 * Get effective publication mode for an AED based on all active assignments
 * Most permissive mode wins (FULL > BASIC_INFO > LOCATION_ONLY > NONE)
 */
export async function getEffectivePublicationMode(aedId: string) {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: {
      publication_mode: true,
      approved_for_full: true,
      approved_by_authority: true,
    },
  });

  if (assignments.length === 0) {
    // No assignments, use AED's own publication_mode
    const aed = await prisma.aed.findUnique({
      where: { id: aedId },
      select: { publication_mode: true },
    });
    return aed?.publication_mode || "NONE";
  }

  // Check for FULL (highest priority)
  const hasFull = assignments.some(
    (a) => a.publication_mode === "FULL" && a.approved_for_full && a.approved_by_authority
  );
  if (hasFull) return "FULL";

  // Check for BASIC_INFO
  const hasBasic = assignments.some(
    (a) => a.publication_mode === "BASIC_INFO" && a.approved_for_full
  );
  if (hasBasic) return "BASIC_INFO";

  // Check for LOCATION_ONLY
  const hasLocation = assignments.some((a) => a.publication_mode === "LOCATION_ONLY");
  if (hasLocation) return "LOCATION_ONLY";

  return "NONE";
}

/**
 * Filter types for verification lists
 */
export type VerificationFilterType =
  | "never_verified" // Nunca verificados (last_verified_at is null), cualquier estado
  | "requires_attention" // Marcados como requires_attention = true
  | "verification_expired" // Verificación caducada (last_verified_at > 6 meses)
  | "rejected"; // DEAs en estado REJECTED (solo admins)

/**
 * Get AEDs that a user can verify based on their role and organization memberships
 *
 * Rules:
 * - ADMIN: can verify all AEDs
 * - Users with organizations: can verify AEDs assigned to their organizations (with can_verify permission)
 * - Users without organizations: cannot verify any AEDs
 */
export async function getVerifiableAedsForUser(
  userId: string,
  userRole: string,
  filters?: {
    organization_id?: string;
    page?: number;
    limit?: number;
    filter_type?: VerificationFilterType;
    search?: string;
  }
) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 12;
  const skip = (page - 1) * limit;
  const filterType = filters?.filter_type || "never_verified";
  const searchTerm = filters?.search?.trim();

  // Build where clause based on filter_type
  let additionalWhere: Record<string, unknown> = {};

  // Build search filter if search term provided
  const searchWhere = searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { name: { contains: searchTerm, mode: "insensitive" as const } },
          { external_reference: { contains: searchTerm, mode: "insensitive" as const } },
          {
            location: {
              OR: [
                { street_name: { contains: searchTerm, mode: "insensitive" as const } },
                { city_name: { contains: searchTerm, mode: "insensitive" as const } },
              ],
            },
          },
        ],
      }
    : {};

  // 6 months ago for expiration check
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Solo DEAs en estado verificable (excluir REJECTED, INACTIVE)
  // DRAFT IS verifiable — verification is the mechanism to review and publish
  const verifiableStatusFilter = {
    status: { in: ["DRAFT", "PENDING_REVIEW", "PUBLISHED"] },
  };

  switch (filterType) {
    case "requires_attention":
      // DEAs marcados como que requieren atención
      additionalWhere = {
        requires_attention: true,
        ...verifiableStatusFilter,
      };
      break;
    case "verification_expired":
      // DEAs con verificación caducada (> 6 meses)
      additionalWhere = {
        last_verified_at: { not: null, lt: sixMonthsAgo },
        ...verifiableStatusFilter,
      };
      break;
    case "rejected":
      // DEAs descartados/rechazados (admin-only, enforced in API route)
      additionalWhere = {
        status: "REJECTED",
      };
      break;
    case "never_verified":
    default:
      // DEAs que nunca se han verificado
      additionalWhere = {
        last_verified_at: null,
        ...verifiableStatusFilter,
      };
      break;
  }

  // ADMIN: can see all AEDs
  if (userRole === "ADMIN") {
    const whereClause = {
      ...additionalWhere,
      ...searchWhere,
    };

    const [aeds, totalCount] = await Promise.all([
      prisma.aed.findMany({
        where: whereClause,
        include: {
          location: true,
          images: {
            where: {
              is_verified: false,
            },
            orderBy: {
              order: "asc",
            },
            take: 3,
          },
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.aed.count({
        where: whereClause,
      }),
    ]);

    return { aeds, totalCount, userOrganizations: [] };
  }

  // Non-admin: get user's organizations with can_verify permission
  const userOrganizations = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      can_verify: true,
    },
    include: {
      organization: true,
    },
  });

  // No organizations = no access
  if (userOrganizations.length === 0) {
    return { aeds: [], totalCount: 0, userOrganizations: [] };
  }

  // Get organization IDs to filter by
  const orgIds = filters?.organization_id
    ? [filters.organization_id]
    : userOrganizations.map((om) => om.organization_id);

  // Get AED IDs that are assigned to these organizations
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      organization_id: { in: orgIds },
      status: "ACTIVE",
      assignment_type: {
        in: ["CIVIL_PROTECTION", "VERIFICATION"],
      },
    },
    select: {
      aed_id: true,
    },
  });

  const aedIds = assignments.map((a) => a.aed_id);

  // No assigned AEDs = no results
  if (aedIds.length === 0) {
    return { aeds: [], totalCount: 0, userOrganizations };
  }

  // Get AEDs with filters
  const whereClause = {
    id: { in: aedIds },
    ...additionalWhere,
    ...searchWhere,
  };

  const [aeds, totalCount] = await Promise.all([
    prisma.aed.findMany({
      where: whereClause,
      include: {
        location: true,
        images: {
          where: {
            is_verified: false,
          },
          orderBy: {
            order: "asc",
          },
          take: 3,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.aed.count({
      where: whereClause,
    }),
  ]);

  return { aeds, totalCount, userOrganizations };
}
