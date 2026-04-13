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
      url: `${baseUrl}/locations/${cityToSlug(city_name)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticPages, ...cityPages];
  } catch {
    // If DB is not available, return only static pages
    return staticPages;
  }
}
