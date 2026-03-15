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
