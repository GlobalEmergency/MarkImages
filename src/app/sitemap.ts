import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import {
  COMMUNITIES,
  communityPath,
  countryPath,
  cityPath,
  resolveRegionSlug,
} from "@/lib/geography";
import { GUIDE_SLUGS } from "@/lib/guides";

/** Google sitemap limit: max 50,000 URLs per file */
const MAX_SITEMAP_URLS = 50_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://deamap.es";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}${countryPath("spain")}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  try {
    // Get all cities with their region info
    // Priority: admin_level_1 (Nominatim) → city_code/postal_code prefix (INE fallback)
    const cities = (await prisma.$queryRaw`
      SELECT l.city_name,
             l.admin_level_1,
             COALESCE(LEFT(NULLIF(l.city_code, ''), 2), LEFT(NULLIF(l.postal_code, ''), 2)) as "ine_code",
             COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
        AND (l.admin_level_1 IS NOT NULL OR COALESCE(NULLIF(l.city_code, ''), NULLIF(l.postal_code, '')) IS NOT NULL)
      GROUP BY l.city_name, l.admin_level_1, COALESCE(LEFT(NULLIF(l.city_code, ''), 2), LEFT(NULLIF(l.postal_code, ''), 2))
      ORDER BY "count" DESC
    `) as {
      city_name: string;
      admin_level_1: string | null;
      ine_code: string | null;
      count: number;
    }[];

    // Community pages (only those with data)
    const communitiesWithData = new Set<string>();
    for (const city of cities) {
      const regionSlug = resolveRegionSlug(city.admin_level_1, city.ine_code);
      if (regionSlug) communitiesWithData.add(regionSlug);
    }

    const communityPages: MetadataRoute.Sitemap = COMMUNITIES.filter((c) =>
      communitiesWithData.has(c.slug)
    ).map((c) => ({
      url: `${baseUrl}${communityPath("spain", c)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

    // City pages — deduplicate by URL to avoid duplicates from mixed admin_level_1/INE data
    const cityPages: MetadataRoute.Sitemap = [];
    const seenCityUrls = new Set<string>();
    const budget =
      MAX_SITEMAP_URLS - staticPages.length - communityPages.length - GUIDE_SLUGS.length;

    for (const { city_name, admin_level_1, ine_code } of cities) {
      if (cityPages.length >= budget) break;
      const regionSlug = resolveRegionSlug(admin_level_1, ine_code);
      if (!regionSlug) continue;
      const url = `${baseUrl}${cityPath("spain", regionSlug, city_name)}`;
      if (seenCityUrls.has(url)) continue;
      seenCityUrls.add(url);
      cityPages.push({
        url,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      });
    }

    // Guide pages
    const guidePages: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
      url: `${baseUrl}/guia/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...communityPages, ...cityPages, ...guidePages];
  } catch (err) {
    console.error("[sitemap] Failed to generate dynamic pages:", err);
    return staticPages;
  }
}
