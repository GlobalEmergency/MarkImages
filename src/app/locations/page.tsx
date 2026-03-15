import { MapPin, Heart, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";

// Revalidate every hour (ISR)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Desfibriladores en España - Todas las ciudades",
  description:
    "Directorio completo de desfibriladores (DEA) por ciudad en España. Encuentra el desfibrilador más cercano en tu ciudad con DeaMap.",
  alternates: {
    canonical: "/locations",
  },
  openGraph: {
    title: "Desfibriladores en España - Todas las ciudades",
    description:
      "Directorio completo de desfibriladores (DEA) por ciudad en España. Encuentra el desfibrilador más cercano.",
    url: "/locations",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Desfibriladores en España - Todas las ciudades",
    description: "Directorio completo de desfibriladores (DEA) por ciudad en España.",
    images: ["/og-image.png"],
  },
};

function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

interface CityCount {
  city_name: string;
  _count: number;
}

async function getCityCounts(): Promise<CityCount[]> {
  try {
    return (await prisma.$queryRaw`
      SELECT l.city_name, COUNT(*)::int as "_count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
      GROUP BY l.city_name
      ORDER BY COUNT(*) DESC
    `) as CityCount[];
  } catch {
    return [];
  }
}

export default async function DesfibriladoresPage() {
  const cityCounts = await getCityCounts();
  const totalAeds = cityCounts.reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Desfibriladores en España</h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            Directorio completo de desfibriladores por ciudad. Encuentra el DEA más cercano a ti.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalAeds.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-300" />
              <span className="font-semibold text-lg">
                {cityCounts.length.toLocaleString("es-ES")}
              </span>
              <span className="text-blue-200">ciudades</span>
            </div>
          </div>
        </div>
      </section>

      {/* City List */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cityCounts.map(({ city_name, _count }) => (
            <Link
              key={city_name}
              href={`/locations/${cityToSlug(city_name)}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all hover:border-blue-300 group flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {city_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {_count} desfibrilador{_count !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* SEO Content */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <h2>Mapa de desfibriladores en España</h2>
            <p>
              DeaMap es el directorio colaborativo de desfibriladores más completo de España, con{" "}
              <strong>{totalAeds.toLocaleString("es-ES")} DEAs</strong> registrados en{" "}
              <strong>{cityCounts.length} ciudades</strong>. Nuestra misión es que cualquier persona
              pueda localizar el desfibrilador más cercano en segundos durante una emergencia
              cardíaca.
            </p>
            <p>
              Un desfibrilador externo automático (DEA) es un dispositivo que puede salvar vidas
              durante una parada cardíaca. Por cada minuto que pasa sin desfibrilación, las
              posibilidades de supervivencia disminuyen un 10%. Saber dónde está el DEA más cercano
              puede marcar la diferencia.
            </p>
            <p>
              <Link href="/" className="text-blue-600 hover:underline">
                Usa nuestro mapa interactivo
              </Link>{" "}
              para encontrar desfibriladores cerca de ti, o{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                colabora añadiendo un DEA
              </Link>{" "}
              que no esté registrado.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
