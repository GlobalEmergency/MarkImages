import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";

import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import JsonLd from "@/components/JsonLd";
import Navigation from "@/components/Navigation";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

import "./globals.css";

const siteUrl = "https://deamap.es";
const siteName = "DeaMap";
const siteDescription =
  "Localiza y verifica desfibriladores en tu zona. Mapa interactivo de DEAs en España con más de 30.000 desfibriladores registrados.";

export const metadata: Metadata = {
  title: {
    default: "DeaMap - Mapa de Desfibriladores en España",
    template: "%s | DeaMap",
  },
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "desfibrilador",
    "DEA",
    "AED",
    "mapa dea",
    "dea mapa",
    "mapa desfibriladores",
    "mapa de desfibriladores",
    "desfibriladores cerca de mi",
    "desfibrilador cerca de mi",
    "desfibrilador mas cercano",
    "dea cerca de mi",
    "dea ubicacion",
    "desfibriladores España",
    "dea españa",
    "emergencia cardíaca",
    "parada cardíaca",
    "desfibrilador cerca",
    "dea near me",
    "AED locator",
    "AED map",
    "defibrillator map",
  ],
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: siteUrl,
    siteName,
    title: "DeaMap - Mapa de Desfibriladores en España",
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DeaMap - Mapa interactivo de desfibriladores en España",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeaMap - Mapa de Desfibriladores en España",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    title: "DeaMap",
    capable: true,
    statusBarStyle: "default",
  },
  category: "health",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="DeaMap" />
        <link rel="manifest" href="/site.webmanifest" />
        <JsonLd />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <GoogleAnalytics />
        <AuthProvider>
          <OrganizationProvider>
            <Navigation />
            <main className="flex-1">{children}</main>
            <Footer />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "#363636",
                  color: "#fff",
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: "#247F52",
                    secondary: "#fff",
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#fff",
                  },
                },
              }}
            />
          </OrganizationProvider>
        </AuthProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
