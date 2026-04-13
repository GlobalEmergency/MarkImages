/**
 * On-demand cache invalidation for AED data.
 *
 * Cache strategy:
 * - Authenticated requests: no CDN cache (private, no-store) — always fresh
 * - Anonymous requests: 24h CDN cache — invalidated surgically when AEDs change
 * - Public API v1: 24h CDN cache — invalidated on-demand
 * - ISR pages (/locations/*): 24h revalidate — invalidated on-demand
 *
 * IMPORTANT: single-AED mutations only invalidate targeted paths (detail, stats,
 * city page). Map/list endpoints (by-bounds, nearby, /api/aeds) are NOT purged
 * on every change — their SWR policy handles gradual freshness. Only bulk
 * operations (imports, batch deletes) purge everything.
 */

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Returns the appropriate Cache-Control header based on authentication.
 * Authenticated users get no cache (instant freshness after mutations).
 * Anonymous users get long CDN cache (purged on-demand via invalidation).
 */
export function getCacheControl(request: NextRequest): string {
  const hasAuth =
    request.cookies.has("auth-token") ||
    request.headers.get("authorization")?.startsWith("Bearer ");

  if (hasAuth) {
    return "private, no-store";
  }
  return "public, s-maxage=86400, stale-while-revalidate=172800";
}

/**
 * Invalidate caches after a single AED is created, updated, or deleted.
 * Only targets specific paths — does NOT purge map/list endpoints.
 *
 * Call this AFTER the database transaction commits successfully.
 */
export function invalidateAedCaches(options?: { aedId?: string; communitySlug?: string }): void {
  // Stats may change (total count, city counts)
  revalidatePath("/api/v1/aeds/stats", "page");

  // Specific AED detail (public API)
  if (options?.aedId) {
    revalidatePath(`/api/v1/aeds/${options.aedId}`, "page");
  }

  // Community location page (AED count per community)
  if (options?.communitySlug) {
    revalidatePath(`/locations/spain/${options.communitySlug}`, "page");
  }
}

/**
 * Invalidate ALL AED caches. Use ONLY for bulk operations
 * (imports, batch deletes, bulk publication changes).
 */
export function invalidateAllAedCaches(): void {
  // Map/list endpoints — only purged on bulk changes
  revalidatePath("/api/aeds", "page");
  revalidatePath("/api/aeds/by-bounds", "page");
  revalidatePath("/api/aeds/nearby", "page");
  revalidatePath("/api/v1/aeds/nearby", "page");
  revalidatePath("/api/v1/aeds/stats", "page");

  // All ISR location pages
  revalidatePath("/locations", "page");
  revalidatePath("/locations/spain", "layout");
  revalidatePath("/sitemap.xml", "page");
}
