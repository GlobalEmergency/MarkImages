import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import {
  COMMUNITIES,
  communityForIneCode,
  communityPath,
  countryPath,
  cityPath,
} from "@/lib/geography";
import { GUIDE_SLUGS } from "@/lib/guides";

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
    // Get all cities with their province INE codes
    const cities = (await prisma.$queryRaw`
      SELECT l.city_name, LEFT(l.city_code, 2) as "ine_code", COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
        AND l.city_code IS NOT NULL
        AND l.city_code != ''
      GROUP BY l.city_name, LEFT(l.city_code, 2)
      ORDER BY l.city_name
    `) as { city_name: string; ine_code: string; count: number }[];

    // Community pages (only those with data)
    const communitiesWithData = new Set<string>();
    for (const city of cities) {
      const community = communityForIneCode(city.ine_code);
      if (community) communitiesWithData.add(community.slug);
    }

    const communityPages: MetadataRoute.Sitemap = COMMUNITIES.filter((c) =>
      communitiesWithData.has(c.slug)
    ).map((c) => ({
      url: `${baseUrl}${communityPath("spain", c)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

    // City pages
    const cityPages: MetadataRoute.Sitemap = [];
    for (const { city_name, ine_code } of cities) {
      const community = communityForIneCode(ine_code);
      if (!community) continue;
      cityPages.push({
        url: `${baseUrl}${cityPath("spain", community.slug, city_name)}`,
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
  } catch {
    return staticPages;
  }
}
