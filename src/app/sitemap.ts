import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import {
  COMMUNITY_BY_SLUG,
  communityPath,
  countryFromCode,
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
  ];

  try {
    // Get all cities with their country and region info
    const cities = (await prisma.$queryRaw`
      SELECT a.country_code,
             l.city_name,
             l.admin_level_1,
             COALESCE(LEFT(NULLIF(l.city_code, ''), 2), LEFT(NULLIF(l.postal_code, ''), 2)) as "ine_code",
             COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.country_code IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
      GROUP BY a.country_code, l.city_name, l.admin_level_1, COALESCE(LEFT(NULLIF(l.city_code, ''), 2), LEFT(NULLIF(l.postal_code, ''), 2))
      ORDER BY "count" DESC
    `) as {
      country_code: string;
      city_name: string;
      admin_level_1: string | null;
      ine_code: string | null;
      count: number;
    }[];

    // Country pages — one per country with data
    const countryCodes = new Set(cities.map((c) => c.country_code));
    const countryPages: MetadataRoute.Sitemap = [...countryCodes].map((code) => {
      const country = countryFromCode(code);
      return {
        url: `${baseUrl}${countryPath(country)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.9,
      };
    });

    // Region pages (communities for Spain, admin_level_1 for others)
    const regionPages: MetadataRoute.Sitemap = [];
    const seenRegionUrls = new Set<string>();

    for (const city of cities) {
      const regionSlug = resolveRegionSlug(city.admin_level_1, city.ine_code);
      if (!regionSlug) continue;
      const country = countryFromCode(city.country_code);
      const url = `${baseUrl}${communityPath(country.slug, regionSlug)}`;
      if (seenRegionUrls.has(url)) continue;
      // For Spain, only emit known communities; for other countries, emit all regions with admin_level_1
      if (city.country_code === "ES" && !COMMUNITY_BY_SLUG.has(regionSlug)) continue;
      if (city.country_code !== "ES" && !city.admin_level_1) continue;
      seenRegionUrls.add(url);
      regionPages.push({
        url,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.85,
      });
    }

    // City pages — deduplicate by URL
    const cityPages: MetadataRoute.Sitemap = [];
    const seenCityUrls = new Set<string>();
    const budget =
      MAX_SITEMAP_URLS -
      staticPages.length -
      countryPages.length -
      regionPages.length -
      GUIDE_SLUGS.length;

    for (const { country_code, city_name, admin_level_1, ine_code } of cities) {
      if (cityPages.length >= budget) break;
      const regionSlug = resolveRegionSlug(admin_level_1, ine_code);
      if (!regionSlug) continue;
      // For Spain, only emit known communities; for others, require admin_level_1
      if (country_code === "ES" && !COMMUNITY_BY_SLUG.has(regionSlug)) continue;
      if (country_code !== "ES" && !admin_level_1) continue;
      const country = countryFromCode(country_code);
      const url = `${baseUrl}${cityPath(country.slug, regionSlug, city_name)}`;
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

    return [...staticPages, ...countryPages, ...regionPages, ...cityPages, ...guidePages];
  } catch (err) {
    console.error("[sitemap] Failed to generate dynamic pages:", err);
    return staticPages;
  }
}
