/**
 * Next.js Middleware - Defense-in-depth authentication layer.
 *
 * Runs BEFORE route handlers to enforce auth on protected paths.
 * Individual route handlers still perform their own auth checks,
 * but this middleware catches cases where a handler forgets to.
 *
 * NOTE: Edge Runtime limitations apply — no Prisma, no Node.js crypto.
 * We only verify that the auth cookie exists and the JWT is structurally valid.
 * Full role-based checks remain in route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "auth-token";

// Paths that require authentication (defense-in-depth)
const PROTECTED_PATH_PREFIXES = [
  "/api/admin/",
  "/api/batch/",
  "/api/import/",
  "/api/export/",
  "/api/verify",
  "/api/upload",
  "/api/deas",
];

// Paths that are always public
const PUBLIC_PATHS = [
  "/api/aeds",
  "/api/auth/",
  "/api/health",
  "/api/geocode",
  "/api/cron/",
  "/api/v1/",
];

function isProtectedPath(pathname: string): boolean {
  // Check public paths first (they take precedence)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return false;
  }

  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Handle CORS preflight requests (OPTIONS) with dynamic origin
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = (
      process.env.MOBILE_CORS_ORIGINS || "capacitor://localhost,http://localhost"
    ).split(",");
    const allowOrigin = allowedOrigins.includes(origin) ? origin : "";

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  // Skip if not a protected path
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Check for auth: Bearer token header first, then cookie
  const authHeader = request.headers.get("Authorization");
  const token =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
    request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verify JWT structure (Edge-compatible using jose)
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // In production without JWT_SECRET, reject all requests
      console.error("[Middleware] JWT_SECRET not configured");
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 });
    }

    const encodedSecret = new TextEncoder().encode(secret);
    await jwtVerify(token, encodedSecret);
  } catch {
    // Token invalid or expired
    return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
