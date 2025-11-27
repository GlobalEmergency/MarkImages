import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'deamap.es - Mapa de Desfibriladores',
  description: 'Localiza y verifica desfibriladores en tu zona. Mapa interactivo de DEAs en España.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={inter.className}>
        <Navigation />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
