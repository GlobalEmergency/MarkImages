import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";

import Navigation from "@/components/Navigation";

import "./globals.css";

export const metadata: Metadata = {
  title: "deamap.es - Mapa de Desfibriladores",
  description:
    "Localiza y verifica desfibriladores en tu zona. Mapa interactivo de DEAs en España.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="font-sans antialiased">
        <Navigation />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
