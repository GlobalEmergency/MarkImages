import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";

function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://deamap.es";

  // Static pages
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
    {
      url: `${baseUrl}/dea/new-simple`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/api/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
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

    const ITEMS_PER_PAGE = 50;
    const cityPages: MetadataRoute.Sitemap = [];

    for (const { city_name, count } of cities) {
      const slug = cityToSlug(city_name);
      const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

      // Page 1 (canonical URL without ?page=)
      cityPages.push({
        url: `${baseUrl}/locations/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      });

      // Additional pages
      for (let page = 2; page <= totalPages; page++) {
        cityPages.push({
          url: `${baseUrl}/locations/${slug}?page=${page}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        });
      }
    }

    return [...staticPages, ...cityPages];
  } catch {
    // If DB is not available, return only static pages
    return staticPages;
  }
}
