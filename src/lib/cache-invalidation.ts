/**
 * On-demand cache invalidation for AED data.
 *
 * Cache strategy:
 * - Internal APIs (/api/aeds/*): 60s TTL — users see changes within ~1 min
 * - Public APIs (/api/v1/*): 24h TTL — invalidated on-demand when AEDs change
 * - ISR pages (/locations/*): 24h revalidate — invalidated on-demand
 *
 * Uses Next.js `revalidatePath()` to purge Vercel CDN cache for long-TTL routes.
 * Internal APIs don't need invalidation — their short TTL handles freshness.
 */

import { revalidatePath } from "next/cache";

/**
 * Invalidate caches after a single AED is created, updated, or deleted.
 * Call this AFTER the database transaction commits successfully.
 */
export function invalidateAedCaches(options?: {
  aedId?: string;
  cityName?: string;
  communitySlug?: string;
}): void {
  // Public API v1 endpoints (24h TTL — need explicit invalidation)
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
