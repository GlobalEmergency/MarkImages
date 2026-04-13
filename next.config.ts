import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instrumentation for import recovery is enabled automatically via src/instrumentation.ts

  // Ensure proper static optimization
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "10mb", // Límite de 10MB para uploads
    },
  },

  // Image optimization settings - restricted to known image sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "*.sharepoint.com",
      },
    ],
  },

  // Output configuration for Vercel
  output: "standalone",

  productionBrowserSourceMaps: process.env.VERCEL_ENV === "preview",

  // Redirects (old URLs → new)
  async redirects() {
    return [
      {
        source: "/desfibriladores",
        destination: "/locations",
        permanent: true,
      },
      {
        source: "/desfibriladores/:path*",
        destination: "/locations/:path*",
        permanent: true,
      },
      // Old province URLs → new community pages (handled dynamically in /locations/provincia/[province])
      // Old city URLs → resolved dynamically in /locations/[city] (catch-all redirect page)
    ];
  },

  // Security headers (CORS is handled dynamically in src/middleware.ts)
  async headers() {
    return [
      // .well-known files for iOS/Android app-domain association (credential autofill)
      {
        source: "/.well-known/:path*",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      // Static assets: immutable hashed files get long cache
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Public static files (icons, manifests, images)
      {
        source:
          "/:path(favicon.ico|og-image.png|manifest.json|robots.txt|sitemap.xml|llms.txt|llms-full.txt)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      // Public API v1: allow CDN caching
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "CDN-Cache-Control", value: "public, max-age=60, stale-while-revalidate=300" },
        ],
      },
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
