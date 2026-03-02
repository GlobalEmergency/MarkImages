import { UserRole } from "@/generated/client/enums";
import { NextRequest } from "next/server";

import type { JWTPayload } from "@/types";

import { getCurrentUserFromRequest } from "./jwt";

/**
 * Get the current user from the request without requiring authentication.
 * Checks Authorization Bearer header first, then falls back to session cookie.
 * Returns null if not authenticated, making it suitable for optional auth checks.
 */
export async function getUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  return getCurrentUserFromRequest(request);
}

/**
 * Middleware to check if user is authenticated.
 * Checks Authorization Bearer header first, then falls back to session cookie.
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload | null> {
  return getCurrentUserFromRequest(request);
}

/**
 * Middleware to check if user has specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<JWTPayload | null> {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}

/**
 * Middleware to check if user is admin
 */
export async function requireAdmin(request: NextRequest): Promise<JWTPayload | null> {
  return requireRole(request, [UserRole.ADMIN]);
}
