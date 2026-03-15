import { Heart, MapPin, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

const ITEMS_PER_PAGE = 50;

// Allow unlisted cities to render on-demand
export const dynamicParams = true;

// Revalidate pages every hour (ISR)
export const revalidate = 3600;

interface Props {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
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

export async function generateStaticParams() {
  try {
    const cities = (await prisma.$queryRaw`
      SELECT l.city_name
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
      GROUP BY l.city_name
      ORDER BY COUNT(*) DESC
      LIMIT 100
    `) as { city_name: string }[];

    return cities.map(({ city_name }) => ({
      city: cityToSlug(city_name),
    }));
  } catch {
    return [];
  }
}

async function resolveCityName(citySlug: string): Promise<string | null> {
  const cityName = slugToCity(citySlug);

  // Check exact match first
  const exact = await prisma.aed.findFirst({
    where: {
      publication_mode: { not: "NONE" },
      published_at: { not: null },
      location: { city_name: { equals: cityName, mode: "insensitive" } },
    },
    include: { location: { select: { city_name: true } } },
  });

  if (exact) return exact.location?.city_name || cityName;

  // Try partial match
  const partial = await prisma.aed.findFirst({
    where: {
      publication_mode: { not: "NONE" },
      published_at: { not: null },
      location: { city_name: { contains: cityName, mode: "insensitive" } },
    },
    include: { location: { select: { city_name: true } } },
  });

  return partial?.location?.city_name || null;
}

interface DistrictCount {
  district_name: string | null;
  count: number;
}

async function getCityStats(cityName: string) {
  const districtCounts = (await prisma.$queryRaw`
    SELECT l.district_name, COUNT(*)::int as "count"
    FROM aeds a
    JOIN aed_locations l ON l.id = a.location_id
    WHERE a.publication_mode != 'NONE'
      AND a.published_at IS NOT NULL
      AND LOWER(l.city_name) = LOWER(${cityName})
    GROUP BY l.district_name
    ORDER BY COUNT(*) DESC
  `) as DistrictCount[];

  const totalCount = districtCounts.reduce((sum, d) => sum + d.count, 0);
  return { totalCount, districtCounts };
}

async function getCityAeds(cityName: string, page: number) {
  return prisma.aed.findMany({
    where: {
      publication_mode: { not: "NONE" },
      published_at: { not: null },
      location: { city_name: { equals: cityName, mode: "insensitive" } },
    },
    include: {
      location: true,
      schedule: true,
    },
    orderBy: [{ location: { district_name: "asc" } }, { name: "asc" }],
    skip: (page - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const { page: pageParam } = await searchParams;
  const cityName = await resolveCityName(city);

  if (!cityName) {
    return { title: "Ciudad no encontrada | DeaMap" };
  }

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const { totalCount } = await getCityStats(cityName);
  const slug = cityToSlug(cityName);
  const pageSuffix = currentPage > 1 ? ` - Página ${currentPage}` : "";
  const title = `Desfibriladores en ${cityName} - ${totalCount} DEAs disponibles${pageSuffix}`;
  const description = `Encuentra ${totalCount} desfibriladores (DEA) en ${cityName}. Mapa interactivo, ubicaciones y horarios de acceso. Localiza el desfibrilador más cercano.`;
  const canonicalUrl =
    currentPage > 1 ? `/locations/${slug}?page=${currentPage}` : `/locations/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
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

export default async function CityDeaPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { page: pageParam } = await searchParams;
  const cityName = await resolveCityName(city);

  if (!cityName) notFound();

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const { totalCount, districtCounts } = await getCityStats(cityName);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const aeds = await getCityAeds(cityName, currentPage);

  // Group current page AEDs by district
  const byDistrict = new Map<string, typeof aeds>();
  for (const aed of aeds) {
    const district = aed.location?.district_name || "Otros";
    if (!byDistrict.has(district)) byDistrict.set(district, []);
    byDistrict.get(district)!.push(aed);
  }

  const sortedDistricts = [...byDistrict.entries()].sort((a, b) => b[1].length - a[1].length);
  const citySlug = cityToSlug(cityName);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "DeaMap",
        item: "https://deamap.es",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Desfibriladores",
        item: "https://deamap.es/locations",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cityName,
        item: `https://deamap.es/locations/${citySlug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              DeaMap
            </Link>
            <span>/</span>
            <Link href="/locations" className="hover:text-white transition-colors">
              Desfibriladores
            </Link>
            <span>/</span>
            <span className="text-white">{cityName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">Desfibriladores en {cityName}</h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            {totalCount} desfibriladores (DEA) registrados en {cityName}. Localiza el más cercano a
            ti y accede a información detallada.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalCount}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            {districtCounts.length > 1 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-300" />
                <span className="font-semibold text-lg">{districtCounts.length}</span>
                <span className="text-blue-200">distritos</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA to map */}
      <section className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 max-w-5xl py-4 flex items-center justify-between">
          <p className="text-gray-600 text-sm">Busca el desfibrilador más cercano a tu ubicación</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <MapPin className="w-4 h-4" />
            Ver en el mapa
          </Link>
        </div>
      </section>

      {/* District Overview (for cities with many districts) */}
      {districtCounts.length > 3 && totalPages > 1 && (
        <section className="bg-white border-b">
          <div className="container mx-auto px-4 max-w-5xl py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Distritos</h2>
            <div className="flex flex-wrap gap-2">
              {districtCounts.map(({ district_name, count }) => (
                <span
                  key={district_name || "otros"}
                  className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full"
                >
                  {district_name || "Otros"}
                  <span className="text-gray-500 text-xs">({count})</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AED Listings by District */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        {/* Pagination info */}
        {totalPages > 1 && (
          <p className="text-sm text-gray-500 mb-6">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} desfibriladores
          </p>
        )}

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

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Paginación">
            {currentPage > 1 && (
              <Link
                href={`/locations/${citySlug}${currentPage === 2 ? "" : `?page=${currentPage - 1}`}`}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Link>
            )}

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, and pages near current
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - currentPage) <= 2) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                if (i > 0 && arr[i - 1] !== p - 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
                    ...
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={`/locations/${citySlug}${item === 1 ? "" : `?page=${item}`}`}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      item === currentPage
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </Link>
                )
              )}

            {currentPage < totalPages && (
              <Link
                href={`/locations/${citySlug}?page=${currentPage + 1}`}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </nav>
        )}

        {/* SEO Content Section - only on first page */}
        {currentPage === 1 && (
          <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Desfibriladores (DEA) en {cityName}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                En {cityName} hay actualmente{" "}
                <strong>{totalCount} desfibriladores externos automáticos (DEA)</strong> registrados
                en DeaMap. Estos dispositivos son esenciales para atender paradas cardíacas, ya que
                pueden aumentar significativamente las posibilidades de supervivencia si se utilizan
                en los primeros minutos.
              </p>
              <p>
                DeaMap te ayuda a localizar el desfibrilador más cercano en {cityName}, con
                información actualizada sobre ubicación, horarios de acceso y cómo llegar. Si
                conoces un desfibrilador que no aparece en el mapa, puedes{" "}
                <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                  agregarlo fácilmente
                </Link>
                .
              </p>
              <h3>¿Qué hacer en caso de emergencia cardíaca?</h3>
              <ol>
                <li>
                  <strong>Llama al 112</strong> inmediatamente.
                </li>
                <li>
                  Inicia la <strong>reanimación cardiopulmonar (RCP)</strong>.
                </li>
                <li>
                  Pide a alguien que busque el <strong>desfibrilador más cercano</strong>.
                </li>
                <li>Sigue las instrucciones del DEA: el dispositivo te guía paso a paso.</li>
              </ol>
            </div>
          </section>
        )}

        {/* Link to other cities */}
        <div className="mt-8 text-center">
          <Link
            href="/locations"
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
