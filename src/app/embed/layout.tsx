/**
 * Embed layout - minimal shell for iframe widgets.
 * Intentionally excludes Navigation, Footer, AuthProvider,
 * and analytics (GTM, SpeedInsights, Analytics) to keep the
 * embedded widget lightweight and independent.
 */

import type { Metadata } from "next";

import "../globals.css";

export const metadata: Metadata = {
  title: "Mapa de Desfibriladores â€” DeaMap",
  description:
    "Widget de mapa integrable con desfibriladores (DEAs) de DeaMap. CÃ³pialo e incrÃºstalo en tu web.",
  robots: {
    // Prevent embed pages from being indexed independently
    index: false,
    follow: false,
  },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
      </head>
      <body className="m-0 p-0 overflow-hidden bg-white">{children}</body>
    </html>
  );
}
