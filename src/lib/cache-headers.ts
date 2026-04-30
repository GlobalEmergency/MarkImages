/**
 * Shared HTTP cache headers for API responses.
 *
 * | Route              | Audience           | TTL                        |
 * |--------------------|--------------------|----------------------------|
 * | /api/aeds/*        | App (map, list)    | 5 min (anon), none (auth)  |
 * | /api/v1/*          | External consumers | 1h                         |
 * | /api/v1/openapi    | Developers         | 24h                        |
 * | /locations/* (ISR) | SEO / crawlers     | 24h (managed by Next.js)   |
 *
 * Both Cache-Control and CDN-Cache-Control are set because Next.js 15
 * may override Cache-Control on route handlers. CDN-Cache-Control is
 * always respected by Vercel Edge.
 */

import type { NextRequest } from "next/server";

/** Headers for public API v1 data endpoints (1h TTL). */
export const V1_PUBLIC_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
  "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
  "Access-Control-Allow-Origin": "*",
} as const;

/** Headers for the OpenAPI spec endpoint (24h TTL, rarely changes). */
export const V1_OPENAPI_HEADERS = {
  "Cache-Control": "public, s-maxage=86400",
  "CDN-Cache-Control": "public, s-maxage=86400",
  "Access-Control-Allow-Origin": "*",
} as const;

/**
 * Dynamic cache headers for internal API routes (/api/aeds/*).
 * - Authenticated → private, no-store (always fresh)
 * - Anonymous → 5 min CDN cache
 */
export function getInternalCacheHeaders(request: NextRequest): Record<string, string> {
  const hasAuth =
    request.cookies.has("auth-token") ||
    request.headers.get("authorization")?.startsWith("Bearer ");

  if (hasAuth) {
    return {
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "private, no-store",
    };
  }
  return {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
  };
}
