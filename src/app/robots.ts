import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/import/", "/org/"],
      },
    ],
    sitemap: "https://deamap.es/sitemap.xml",
  };
}
