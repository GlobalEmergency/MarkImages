/**
 * On-demand cache invalidation for AED data.
 *
 * Strategy: all public endpoints use long TTLs (24h) with stale-while-revalidate.
 * When AED data changes, we invalidate specific paths so Vercel purges the CDN
 * cache and the next request gets fresh data.
 *
 * Uses Next.js `revalidatePath()` which works both for ISR pages and API routes
 * cached at the CDN level on Vercel.
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
  // Map/list endpoints — always invalidate on any AED change
  revalidatePath("/api/aeds", "page");
  revalidatePath("/api/aeds/by-bounds", "page");
  revalidatePath("/api/aeds/nearby", "page");
  revalidatePath("/api/v1/aeds/stats", "page");
  revalidatePath("/api/v1/aeds/nearby", "page");

  // ISR location pages
  revalidatePath("/locations", "page");
  revalidatePath("/locations/spain", "page");

  // Specific AED detail
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
