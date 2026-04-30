/**
 * On-demand cache invalidation for AED data.
 *
 * revalidatePath only works on ISR pages and fetch-cached data — NOT on
 * API route handlers that set their own Cache-Control headers. Route
 * handler freshness is managed by TTLs in cache-headers.ts.
 *
 * - Single AED change: invalidate v1 detail + stats + v1 city endpoint
 * - Bulk operations: invalidate all v1 endpoints + ISR location pages
 */

import { revalidatePath } from "next/cache";

/**
 * Invalidate caches after a single AED is created or updated.
 * Only targets ISR pages and v1 detail — internal API routes rely on
 * their 5 min TTL for natural freshness.
 */
export function invalidateAedCaches(aedId: string): void {
  revalidatePath(`/api/v1/aeds/${aedId}`, "page");
  revalidatePath("/api/v1/aeds/stats", "page");
}

/**
 * Invalidate ALL AED caches. Use for bulk operations
 * (imports, batch deletes, bulk publication changes, AED deletion).
 */
export function invalidateAllAedCaches(): void {
  // Public API v1 endpoints
  revalidatePath("/api/v1/aeds/stats", "page");
  revalidatePath("/api/v1/aeds/nearby", "page");

  // ISR location pages
  revalidatePath("/locations/spain", "layout");
  revalidatePath("/sitemap.xml", "page");
}
