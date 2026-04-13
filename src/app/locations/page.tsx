import { MapPin, Heart, ArrowRight, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { PROVINCES, PROVINCE_BY_INE, type Province } from "@/lib/provinces";

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

interface ProvinceCount {
  province_code: string;
  count: number;
}

async function getProvinceCounts(): Promise<(Province & { count: number })[]> {
  try {
    const raw = (await prisma.$queryRaw`
      SELECT LEFT(l.city_code, 2) as "province_code", COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_code IS NOT NULL
        AND l.city_code != ''
      GROUP BY LEFT(l.city_code, 2)
      ORDER BY COUNT(*) DESC
    `) as ProvinceCount[];

    return raw
      .map((r) => {
        const province = PROVINCE_BY_INE.get(r.province_code);
        return province ? { ...province, count: r.count } : null;
      })
      .filter((p): p is Province & { count: number } => p !== null);
  } catch {
    return [];
  }
}

export default async function DesfibriladoresPage() {
  const cityCounts = await getCityCounts();
  const provinceCounts = await getProvinceCounts();
  const totalAeds = cityCounts.reduce((sum, c) => sum + c._count, 0);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Desfibriladores por ciudad en España",
    description: `Directorio de desfibriladores en ${cityCounts.length} ciudades de España`,
    numberOfItems: cityCounts.length,
    itemListElement: cityCounts.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://deamap.es/locations/${cityToSlug(c.city_name)}`,
      name: `Desfibriladores en ${c.city_name}`,
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
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

      {/* Provinces Section */}
      {provinceCounts.length > 0 && (
        <div className="container mx-auto px-4 max-w-5xl pt-8 pb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Por provincia
          </h2>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {provinceCounts.map((p) => (
              <Link
                key={p.slug}
                href={`/locations/provincia/${p.slug}`}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all hover:border-blue-300 group flex items-center justify-between"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-sm">
                    {p.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {p.count} DEA{p.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
          {/* Show all provinces link when there are provinces without data */}
          {provinceCounts.length < PROVINCES.length && (
            <p className="text-sm text-gray-500 mt-3">
              Mostrando {provinceCounts.length} de {PROVINCES.length} provincias con datos. Estamos
              ampliando la cobertura.
            </p>
          )}
        </div>
      )}

      {/* City List */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-blue-600" />
          Por ciudad
        </h2>
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
