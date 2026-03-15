import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/docs", "/api/v1/openapi.json"],
        disallow: ["/admin/", "/api/", "/import/", "/org/"],
      },
    ],
    sitemap: "https://deamap.es/sitemap.xml",
  };
}
