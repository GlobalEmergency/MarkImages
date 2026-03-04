import { UserRole } from "@/generated/client/enums";
import { NextRequest } from "next/server";

import type { JWTPayload } from "@/types";

import { getCurrentUserFromRequest } from "./jwt";

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
