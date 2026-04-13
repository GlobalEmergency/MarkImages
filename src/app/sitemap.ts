import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { GUIDE_SLUGS } from "@/lib/guides";
import { PROVINCE_BY_INE, toSlug } from "@/lib/provinces";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://deamap.es";

  // Static pages (only pages with SEO value)
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Dynamic city pages with pagination
  try {
    const cities = (await prisma.$queryRaw`
      SELECT l.city_name, COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
      GROUP BY l.city_name
      ORDER BY l.city_name
    `) as { city_name: string; count: number }[];

    const cityPages: MetadataRoute.Sitemap = cities.map(({ city_name }) => ({
      url: `${baseUrl}/locations/${toSlug(city_name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Province pages (only those with data)
    const provinceCodes = (await prisma.$queryRaw`
      SELECT DISTINCT LEFT(l.city_code, 2) as "code"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_code IS NOT NULL
        AND l.city_code != ''
    `) as { code: string }[];

    const provincePages: MetadataRoute.Sitemap = provinceCodes
      .map(({ code }) => PROVINCE_BY_INE.get(code))
      .filter((p) => p !== undefined)
      .map((p) => ({
        url: `${baseUrl}/locations/provincia/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.85,
      }));

    // Guide pages
    const guidePages: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
      url: `${baseUrl}/guia/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...provincePages, ...cityPages, ...guidePages];
  } catch {
    // If DB is not available, return only static pages
    return staticPages;
  }
}
