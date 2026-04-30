import { Globe, Heart, MapPin, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { countryFromCode, countryPath } from "@/lib/geography";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Desfibriladores en el mundo - Directorio por paÃ­s",
  description:
    "Directorio mundial de desfibriladores (DEA/AED). Encuentra el desfibrilador mÃ¡s cercano por paÃ­s, regiÃ³n y ciudad con DeaMap.",
  alternates: { canonical: "/locations" },
  openGraph: {
    title: "Desfibriladores en el mundo - Directorio por paÃ­s",
    description: "Directorio mundial de desfibriladores (DEA/AED). Encuentra el mÃ¡s cercano.",
    url: "/locations",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Desfibriladores en el mundo - Directorio por paÃ­s",
    description: "Directorio mundial de desfibriladores (DEA/AED).",
    images: ["/og-image.png"],
  },
};

interface CountryStats {
  country_code: string;
  aed_count: number;
  city_count: number;
}

async function getCountryStats(): Promise<CountryStats[]> {
  try {
    return (await prisma.$queryRaw`
      SELECT a.country_code, COUNT(*)::int as "aed_count",
             COUNT(DISTINCT l.city_name)::int as "city_count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
      GROUP BY a.country_code
      ORDER BY COUNT(*) DESC
    `) as CountryStats[];
  } catch {
    return [];
  }
}

export default async function LocationsIndexPage() {
  const stats = await getCountryStats();
  const totalAeds = stats.reduce((sum, s) => sum + s.aed_count, 0);
  const totalCities = stats.reduce((sum, s) => sum + s.city_count, 0);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Desfibriladores por paÃ­s",
    numberOfItems: stats.length,
    itemListElement: stats
      .filter((s) => s.country_code)
      .map((s, i) => {
        const country = countryFromCode(s.country_code);
        return {
          "@type": "ListItem",
          position: i + 1,
          url: `https://deamap.es${countryPath(country)}`,
          name: `Desfibriladores en ${country.name}`,
        };
      }),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Directorio de desfibriladores</h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            Encuentra desfibriladores (DEA) en todo el mundo. Navega por paÃ­s, regiÃ³n y ciudad.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalAeds.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-300" />
              <span className="font-semibold text-lg">{totalCities.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">ciudades</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-yellow-300" />
              <span className="font-semibold text-lg">{stats.length}</span>
              <span className="text-blue-200">paÃ­s{stats.length !== 1 ? "es" : ""}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Country List */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Globe className="w-6 h-6 text-blue-600" />
          PaÃ­ses con desfibriladores
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats
            .filter((s) => s.country_code)
            .map((s) => {
              const country = countryFromCode(s.country_code);
              return (
                <Link
                  key={s.country_code}
                  href={countryPath(country)}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-all hover:border-blue-300 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                      {country.name}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-red-400" />
                      {s.aed_count.toLocaleString("es-ES")} DEAs
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      {s.city_count.toLocaleString("es-ES")} ciudad{s.city_count !== 1 ? "es" : ""}
                    </span>
                  </div>
                </Link>
              );
            })}
        </div>

        {/* SEO Content */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <h2>Mapa mundial de desfibriladores</h2>
            <p>
              DeaMap es el directorio colaborativo de desfibriladores mÃ¡s completo, con{" "}
              <strong>{totalAeds.toLocaleString("es-ES")} DEAs</strong> registrados en{" "}
              <strong>{totalCities.toLocaleString("es-ES")} ciudades</strong> de{" "}
              <strong>
                {stats.length} paÃ­s{stats.length !== 1 ? "es" : ""}
              </strong>
              . Nuestra misiÃ³n es que cualquier persona pueda localizar el desfibrilador mÃ¡s
              cercano en segundos durante una emergencia cardÃ­aca.
            </p>
            <p>
              Un desfibrilador externo automÃ¡tico (DEA) es un dispositivo que puede salvar vidas
              durante una parada cardÃ­aca. Por cada minuto que pasa sin desfibrilaciÃ³n, las
              posibilidades de supervivencia disminuyen un 10%.{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                Usa nuestro mapa interactivo
              </Link>{" "}
              para encontrar desfibriladores cerca de ti, o{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                colabora aÃ±adiendo un DEA
              </Link>{" "}
              que no estÃ© registrado.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
