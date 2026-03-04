import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import type { JWTPayload } from "@/types";

const COOKIE_NAME = "auth-token";

/**
 * Lazily resolve the JWT secret.
 * In production, throws if JWT_SECRET is missing (at runtime, not build time).
 * In dev, falls back to a placeholder secret.
 */
function getSecret(): Uint8Array {
  const key = process.env.JWT_SECRET;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return new TextEncoder().encode(key || "dev-only-secret-not-for-production");
}

/**
 * Create a JWT token
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Validate payload structure instead of blind cast
    const { userId, email, role } = payload as Record<string, unknown>;
    if (typeof userId !== "string" || typeof email !== "string" || typeof role !== "string") {
      return null;
    }
    return { userId, email, role } as JWTPayload;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("JWT verification failed:", error instanceof Error ? error.message : "unknown");
    }
    return null;
  }
}

/**
 * Get the current user from the session cookie
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);

  if (!token) {
    return null;
  }

  return verifyToken(token.value);
}

/**
 * Set the auth token cookie
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

/**
 * Remove the auth token cookie
 */
export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get the current user from a NextRequest.
 * Checks the Authorization Bearer header first, then falls back to the session cookie.
 * Use this in API route handlers where you have access to the request object.
 */
export async function getCurrentUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  // 1. Try Authorization: Bearer <token> header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      return verifyToken(token);
    }
  }

  // 2. Fallback to cookie
  return getCurrentUser();
}
