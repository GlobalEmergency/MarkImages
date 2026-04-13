/**
 * On-demand cache invalidation for AED data.
 *
 * Cache strategy:
 * - Authenticated requests: no CDN cache (private, no-store) — always fresh
 * - Anonymous requests: 24h CDN cache — invalidated on-demand when AEDs change
 * - Public API v1: 24h CDN cache — invalidated on-demand
 * - ISR pages (/locations/*): 24h revalidate — invalidated on-demand
 *
 * Uses Next.js `revalidatePath()` to purge Vercel CDN cache for long-TTL routes.
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
 * Call this AFTER the database transaction commits successfully.
 */
export function invalidateAedCaches(options?: {
  aedId?: string;
  cityName?: string;
  communitySlug?: string;
}): void {
  // Internal API endpoints (cached for anonymous users)
  revalidatePath("/api/aeds", "page");
  revalidatePath("/api/aeds/by-bounds", "page");
  revalidatePath("/api/aeds/nearby", "page");

  // Public API v1 endpoints (24h TTL)
  revalidatePath("/api/v1/aeds/stats", "page");
  revalidatePath("/api/v1/aeds/nearby", "page");

  // ISR location pages (24h revalidate)
  revalidatePath("/locations", "page");
  revalidatePath("/locations/spain", "page");

  // Specific AED detail (public API)
  if (options?.aedId) {
    revalidatePath(`/api/v1/aeds/${options.aedId}`, "page");
  }

  // Community page
  if (options?.communitySlug) {
    revalidatePath(`/locations/spain/${options.communitySlug}`, "page");
  }
}

/**
 * Invalidate ALL AED caches. Use for bulk operations (imports, batch deletes).
 */
export function invalidateAllAedCaches(): void {
  invalidateAedCaches();

  // Also invalidate sitemap and all location sub-pages
  revalidatePath("/sitemap.xml", "page");
  revalidatePath("/locations/spain", "layout");
}
