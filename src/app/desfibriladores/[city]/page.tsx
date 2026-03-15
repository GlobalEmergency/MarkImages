import { Heart, MapPin, Clock, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ city: string }>;
}

function slugToCity(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function getCityData(citySlug: string) {
  const cityName = slugToCity(citySlug);

  // Search for the city case-insensitively
  const aeds = await prisma.aed.findMany({
    where: {
      publication_mode: { not: "NONE" },
      published_at: { not: null },
      location: {
        city_name: { equals: cityName, mode: "insensitive" },
      },
    },
    include: {
      location: true,
      schedule: true,
    },
    orderBy: { name: "asc" },
  });

  if (aeds.length === 0) {
    // Try partial match
    const partialAeds = await prisma.aed.findMany({
      where: {
        publication_mode: { not: "NONE" },
        published_at: { not: null },
        location: {
          city_name: { contains: cityName, mode: "insensitive" },
        },
      },
      include: {
        location: true,
        schedule: true,
      },
      orderBy: { name: "asc" },
    });

    if (partialAeds.length === 0) return null;

    const actualCityName = partialAeds[0].location?.city_name || cityName;
    return { cityName: actualCityName, aeds: partialAeds };
  }

  const actualCityName = aeds[0].location?.city_name || cityName;
  return { cityName: actualCityName, aeds };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const data = await getCityData(city);

  if (!data) {
    return { title: "Ciudad no encontrada | DeaMap" };
  }

  const { cityName, aeds } = data;
  const count = aeds.length;
  const title = `Desfibriladores en ${cityName} - ${count} DEAs disponibles`;
  const description = `Encuentra ${count} desfibriladores (DEA) en ${cityName}. Mapa interactivo, ubicaciones y horarios de acceso. Localiza el desfibrilador más cercano.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/desfibriladores/${cityToSlug(cityName)}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/desfibriladores/${cityToSlug(cityName)}`,
      images: [{ url: "/og-image.png", alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function CityDeaPage({ params }: Props) {
  const { city } = await params;
  const data = await getCityData(city);

  if (!data) notFound();

  const { cityName, aeds } = data;

  // Group by district if available
  const byDistrict = new Map<string, typeof aeds>();
  for (const aed of aeds) {
    const district = aed.location?.district_name || "Otros";
    if (!byDistrict.has(district)) byDistrict.set(district, []);
    byDistrict.get(district)!.push(aed);
  }

  const sortedDistricts = [...byDistrict.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              DeaMap
            </Link>
            <span>/</span>
            <Link href="/desfibriladores" className="hover:text-white transition-colors">
              Desfibriladores
            </Link>
            <span>/</span>
            <span className="text-white">{cityName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Desfibriladores en {cityName}
          </h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            {aeds.length} desfibriladores (DEA) registrados en {cityName}.
            Localiza el más cercano a ti y accede a información detallada.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{aeds.length}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            {byDistrict.size > 1 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-300" />
                <span className="font-semibold text-lg">{byDistrict.size}</span>
                <span className="text-blue-200">distritos</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA to map */}
      <section className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 max-w-5xl py-4 flex items-center justify-between">
          <p className="text-gray-600 text-sm">
            Busca el desfibrilador más cercano a tu ubicación
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <MapPin className="w-4 h-4" />
            Ver en el mapa
          </Link>
        </div>
      </section>

      {/* AED Listings by District */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        {sortedDistricts.map(([district, districtAeds]) => (
          <section key={district} className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              {district}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({districtAeds.length} DEA{districtAeds.length !== 1 ? "s" : ""})
              </span>
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              {districtAeds.map((aed) => {
                const address = [
                  aed.location?.street_type,
                  aed.location?.street_name,
                  aed.location?.street_number,
                ]
                  .filter(Boolean)
                  .join(" ");

                const is24h = aed.schedule?.has_24h_surveillance;

                return (
                  <Link
                    key={aed.id}
                    href={`/dea/${aed.id}`}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all hover:border-blue-300 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {aed.name}
                        </h3>
                        {address && (
                          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {address}
                          </p>
                        )}
                        {aed.schedule && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {is24h
                              ? "Disponible 24h"
                              : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                                ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                                : "Horario no especificado"}
                          </p>
                        )}
                      </div>
                      {is24h && (
                        <span className="flex-shrink-0 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          24h
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* SEO Content Section */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Desfibriladores (DEA) en {cityName}
          </h2>
          <div className="prose prose-gray max-w-none">
            <p>
              En {cityName} hay actualmente <strong>{aeds.length} desfibriladores externos
              automáticos (DEA)</strong> registrados en DeaMap. Estos dispositivos son esenciales
              para atender paradas cardíacas, ya que pueden aumentar significativamente las
              posibilidades de supervivencia si se utilizan en los primeros minutos.
            </p>
            <p>
              DeaMap te ayuda a localizar el desfibrilador más cercano en {cityName}, con
              información actualizada sobre ubicación, horarios de acceso y cómo llegar.
              Si conoces un desfibrilador que no aparece en el mapa, puedes{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                agregarlo fácilmente
              </Link>
              .
            </p>
            <h3>¿Qué hacer en caso de emergencia cardíaca?</h3>
            <ol>
              <li><strong>Llama al 112</strong> inmediatamente.</li>
              <li>Inicia la <strong>reanimación cardiopulmonar (RCP)</strong>.</li>
              <li>Pide a alguien que busque el <strong>desfibrilador más cercano</strong>.</li>
              <li>Sigue las instrucciones del DEA: el dispositivo te guía paso a paso.</li>
            </ol>
          </div>
        </section>

        {/* Link to other cities */}
        <div className="mt-8 text-center">
          <Link
            href="/desfibriladores"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Ver todas las ciudades con desfibriladores
          </Link>
        </div>
      </div>
    </div>
  );
}
