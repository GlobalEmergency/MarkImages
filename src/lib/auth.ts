import { NextRequest } from "next/server";
import { getCurrentUser } from "./jwt";
import type { JWTPayload } from "@/types";
import { UserRole } from "@prisma/client";

/**
 * Middleware to check if user is authenticated
 */
export async function requireAuth(
  request: NextRequest
): Promise<JWTPayload | null> {
  const user = await getCurrentUser();
  return user;
}

/**
 * Middleware to check if user has specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<JWTPayload | null> {
  const user = await getCurrentUser();

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
export async function requireAdmin(
  request: NextRequest
): Promise<JWTPayload | null> {
  return requireRole(request, [UserRole.ADMIN]);
}
