/**
 * Cache and on-demand invalidation for AED data.
 *
 * Cache strategy by audience:
 *
 * | Route                  | Audience            | TTL         |
 * |------------------------|---------------------|-------------|
 * | /api/aeds/*            | App (map, list)     | 5 min (anon), none (auth) |
 * | /api/v1/*              | External consumers  | 1h + on-demand invalidation |
 * | /locations/* (ISR)     | SEO / crawlers      | 24h         |
 *
 * On-demand invalidation (revalidatePath):
 * - Single AED change: only stats + detail endpoint
 * - Bulk operations: purge all cached routes
 */

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

// ── Cache-Control helpers ───────────────────────────────────────────

/**
 * Cache-Control for internal API routes (/api/aeds/*).
 * Authenticated users always get fresh data; anonymous users get 5 min CDN cache.
 */
export function getCacheControl(request: NextRequest): string {
  const hasAuth =
    request.cookies.has("auth-token") ||
    request.headers.get("authorization")?.startsWith("Bearer ");

  if (hasAuth) {
    return "private, no-store";
  }
  return "public, s-maxage=300, stale-while-revalidate=60";
}

// ── On-demand invalidation ──────────────────────────────────────────

/**
 * Invalidate caches after a single AED is created, updated, or deleted.
 * Only targets specific paths — does NOT purge map/list endpoints
 * (their 5 min TTL handles freshness naturally).
 *
 * Call AFTER the database transaction commits successfully.
 */
export function invalidateAedCaches(options?: { aedId?: string; communitySlug?: string }): void {
  // Stats may change (total count, city counts)
  revalidatePath("/api/v1/aeds/stats", "page");

  // Specific AED detail (public API, 1h TTL)
  if (options?.aedId) {
    revalidatePath(`/api/v1/aeds/${options.aedId}`, "page");
  }

  // Community location page
  if (options?.communitySlug) {
    revalidatePath(`/locations/spain/${options.communitySlug}`, "page");
  }
}

/**
 * Invalidate ALL AED caches. Use ONLY for bulk operations
 * (imports, batch deletes, bulk publication changes).
 */
export function invalidateAllAedCaches(): void {
  // Internal API endpoints (5 min TTL, but force-purge on bulk changes)
  revalidatePath("/api/aeds", "page");
  revalidatePath("/api/aeds/by-bounds", "page");
  revalidatePath("/api/aeds/nearby", "page");

  // Public API v1 (1h TTL)
  revalidatePath("/api/v1/aeds/nearby", "page");
  revalidatePath("/api/v1/aeds/stats", "page");

  // All ISR location pages (24h)
  revalidatePath("/locations", "page");
  revalidatePath("/locations/spain", "layout");
  revalidatePath("/sitemap.xml", "page");
}
