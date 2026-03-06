import { UserRole } from "@/generated/client/enums";
import { NextRequest } from "next/server";

import type { JWTPayload } from "@/types";

import { getCurrentUserFromRequest } from "./jwt";
import { getUserPermissionsForAed } from "@/lib/organization-permissions";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Get the current user from the request without requiring authentication.
 * Returns null if not authenticated — suitable for optional auth checks.
 */
export async function getUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  return getCurrentUserFromRequest(request);
}

/**
 * Require the user to be authenticated. Throws AuthError if not.
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    throw new AuthError("No autenticado");
  }
  return user;
}

/**
 * Require the user to have a specific role. Throws AuthError if not.
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<JWTPayload> {
  const user = await requireAuth(request);
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError("No tienes permisos para esta acción", 403);
  }
  return user;
}

/**
 * Require the user to be an admin. Throws AuthError if not.
 */
export async function requireAdmin(request: NextRequest): Promise<JWTPayload> {
  return requireRole(request, [UserRole.ADMIN]);
}

type AedPermission = "can_view" | "can_edit" | "can_verify" | "can_approve";

interface AedAuthResult {
  user: JWTPayload;
  isGlobalAdmin: boolean;
  permissions: { can_view: boolean; can_edit: boolean; can_verify: boolean; can_approve: boolean };
}

/**
 * Require global ADMIN role OR organization-level permission for a specific AED.
 *
 * - Global ADMINs pass immediately (no extra DB queries).
 * - Non-admins: checks org-level permissions via getUserPermissionsForAed (2 DB queries)
 *   and verifies the requested permission.
 * - Returns { user, isGlobalAdmin, permissions } so handlers can differentiate behavior
 *   (e.g. restrict fields for org editors vs global admins in the future).
 */
export async function requireAdminOrAedPermission(
  request: NextRequest,
  aedId: string,
  requiredPermission: AedPermission
): Promise<AedAuthResult> {
  const user = await requireAuth(request);

  // Global admin: full access, skip DB queries
  if (user.role === UserRole.ADMIN) {
    return {
      user,
      isGlobalAdmin: true,
      permissions: { can_view: true, can_edit: true, can_verify: true, can_approve: true },
    };
  }

  // Check org-level permissions for this specific AED
  const permissions = await getUserPermissionsForAed(user.userId, aedId);
  if (!permissions[requiredPermission]) {
    throw new AuthError("No tienes permisos para esta acción", 403);
  }

  return { user, isGlobalAdmin: false, permissions };
}
