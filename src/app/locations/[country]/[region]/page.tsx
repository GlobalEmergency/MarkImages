import { Heart, MapPin, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/db";
import {
  COMMUNITIES,
  COMMUNITY_BY_SLUG,
  countryFromSlug,
  toSlug,
  cityPath,
  communityPath,
  countryPath,
} from "@/lib/geography";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: Promise<{ country: string; region: string }>;
}

interface CityInRegion {
  city_name: string;
  count: number;
}

/**
 * Get cities in a region using admin_level_1 as primary source,
 * falling back to INE province codes for records not yet enriched (Spain only).
 */
const getRegionCities = cache(
  async (communityName: string, ineCodes: string[]): Promise<CityInRegion[]> => {
    try {
      if (ineCodes.length > 0) {
        // Spain: match by admin_level_1 OR INE fallback
        return (await prisma.$queryRaw`
          SELECT l.city_name, COUNT(*)::int as "count"
          FROM aeds a
          JOIN aed_locations l ON l.id = a.location_id
          WHERE a.status = 'PUBLISHED'
            AND a.publication_mode != 'NONE'
            AND l.city_name IS NOT NULL
            AND l.city_name != ''
            AND (
              l.admin_level_1 = ${communityName}
              OR (l.admin_level_1 IS NULL AND COALESCE(LEFT(NULLIF(l.city_code, ''), 2), LEFT(NULLIF(l.postal_code, ''), 2)) = ANY(${ineCodes}))
            )
          GROUP BY l.city_name
          ORDER BY COUNT(*) DESC
        `) as CityInRegion[];
      }
      // Non-Spain: match only by admin_level_1
      return (await prisma.$queryRaw`
        SELECT l.city_name, COUNT(*)::int as "count"
        FROM aeds a
        JOIN aed_locations l ON l.id = a.location_id
        WHERE a.status = 'PUBLISHED'
          AND a.publication_mode != 'NONE'
          AND l.city_name IS NOT NULL
          AND l.city_name != ''
          AND l.admin_level_1 = ${communityName}
        GROUP BY l.city_name
        ORDER BY COUNT(*) DESC
      `) as CityInRegion[];
    } catch {
      return [];
    }
  }
);

export async function generateStaticParams() {
  return COMMUNITIES.map((c) => ({ country: "spain", region: c.slug }));
}

/**
 * Resolve region info from slug. For Spain, uses static COMMUNITY_BY_SLUG.
 * For other countries, queries admin_level_1 from the database.
 */
const resolveRegion = cache(
  async (
    regionSlug: string,
    countryCode: string
  ): Promise<{ name: string; ineCodes: string[] } | null> => {
    // Try static Spanish community first
    const community = COMMUNITY_BY_SLUG.get(regionSlug);
    if (community) return { name: community.name, ineCodes: community.provinceIneCodes };

    // For non-Spain (or unknown Spanish regions), query DB for admin_level_1
    try {
      const result = (await prisma.$queryRaw`
      SELECT DISTINCT l.admin_level_1
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.country_code = ${countryCode}
        AND l.admin_level_1 IS NOT NULL
    `) as { admin_level_1: string }[];

      const match = result.find((r) => toSlug(r.admin_level_1) === regionSlug);
      if (match) return { name: match.admin_level_1, ineCodes: [] };
    } catch {
      // Fall through
    }
    return null;
  }
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: countrySlug, region: regionSlug } = await params;
  const country = countryFromSlug(countrySlug);
  if (!country) return { title: "Región no encontrada | DeaMap" };

  const region = await resolveRegion(regionSlug, country.code);
  if (!region) return { title: "Región no encontrada | DeaMap" };

  const cities = await getRegionCities(region.name, region.ineCodes);
  const totalCount = cities.reduce((sum, c) => sum + c.count, 0);

  const title = `Desfibriladores en ${region.name} — ${totalCount.toLocaleString("es-ES")} DEAs en ${cities.length} ciudades`;
  const description = `Encuentra ${totalCount.toLocaleString("es-ES")} desfibriladores (DEA) en ${region.name}, ${country.name}. Directorio de ${cities.length} ciudades con ubicaciones y horarios de acceso.`;
  const canonical = communityPath(countrySlug, regionSlug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: [{ url: "/og-image.png", alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  };
}

export default async function RegionPage({ params }: Props) {
  const { country: countrySlug, region: regionSlug } = await params;
  const country = countryFromSlug(countrySlug);
  if (!country) notFound();

  const region = await resolveRegion(regionSlug, country.code);
  if (!region) notFound();

  const regionName = region.name;
  const cities = await getRegionCities(regionName, region.ineCodes);
  const totalCount = cities.reduce((sum, c) => sum + c.count, 0);
  const avg = cities.length > 0 ? Math.round(totalCount / cities.length) : 0;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "DeaMap", item: "https://deamap.es" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Desfibriladores",
        item: "https://deamap.es/locations",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: country.name,
        item: `https://deamap.es${countryPath(country)}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: regionName,
        item: `https://deamap.es${communityPath(countrySlug, regionSlug)}`,
      },
    ],
  };

  const itemListLd =
    cities.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Desfibriladores en ${regionName} por ciudad`,
          numberOfItems: cities.length,
          itemListElement: cities.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://deamap.es${cityPath(countrySlug, regionSlug, c.city_name)}`,
            name: `Desfibriladores en ${c.city_name}`,
          })),
        }
      : null;

  const topCity = cities[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }}
        />
      )}

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
            <Link href={countryPath(country)} className="hover:text-white transition-colors">
              {country.name}
            </Link>
            <span>/</span>
            <span className="text-white">{regionName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">Desfibriladores en {regionName}</h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            {totalCount > 0
              ? `${totalCount.toLocaleString("es-ES")} desfibriladores (DEA) en ${cities.length} ciudad${cities.length !== 1 ? "es" : ""} de ${regionName}.`
              : `Directorio de desfibriladores en ${regionName}. Próximamente con datos actualizados.`}
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalCount.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-300" />
              <span className="font-semibold text-lg">{cities.length}</span>
              <span className="text-blue-200">ciudad{cities.length !== 1 ? "es" : ""}</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
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

      {/* City List */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        {cities.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cities.map(({ city_name, count }) => (
              <Link
                key={city_name}
                href={cityPath(countrySlug, regionSlug, city_name)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all hover:border-blue-300 group flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {city_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {count} desfibrilador{count !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Aún no hay desfibriladores registrados en {regionName}
            </h2>
            <p className="text-gray-500 mb-6">
              Estamos ampliando nuestra cobertura. Si conoces la ubicación de un DEA en {regionName}
              , puedes añadirlo.
            </p>
            <Link
              href="/dea/new-simple"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <MapPin className="w-4 h-4" />
              Agregar un DEA
            </Link>
          </div>
        )}

        {/* SEO Content with stats */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <h2>Desfibriladores (DEA) en {regionName}</h2>
            <p>
              {regionName} cuenta con{" "}
              <strong>
                {totalCount.toLocaleString("es-ES")} desfibriladores externos automáticos (DEA)
              </strong>{" "}
              registrados en DeaMap
              {cities.length > 0 && (
                <>
                  , distribuidos en{" "}
                  <strong>
                    {cities.length} ciudad{cities.length !== 1 ? "es" : ""}
                  </strong>
                </>
              )}
              . Esto supone una media de <strong>{avg} DEAs por ciudad</strong>.
              {topCity && (
                <>
                  {" "}
                  La ciudad con mayor cobertura es{" "}
                  <Link
                    href={cityPath(countrySlug, regionSlug, topCity.city_name)}
                    className="text-blue-600 hover:underline"
                  >
                    {topCity.city_name}
                  </Link>{" "}
                  con {topCity.count.toLocaleString("es-ES")} desfibriladores.
                </>
              )}
            </p>
            <p>
              Un desfibrilador externo automático (DEA) es un dispositivo portátil que puede salvar
              vidas durante una parada cardíaca. Por cada minuto sin desfibrilación, las
              posibilidades de supervivencia disminuyen un 10%.
            </p>
            <h3>¿Qué hacer en caso de emergencia cardíaca en {regionName}?</h3>
            <ol>
              <li>
                <strong>Llama al 112</strong> inmediatamente.
              </li>
              <li>
                Inicia la <strong>reanimación cardiopulmonar (RCP)</strong>.
              </li>
              <li>
                Pide a alguien que busque el <strong>desfibrilador más cercano</strong> usando
                DeaMap.
              </li>
              <li>Sigue las instrucciones del DEA: el dispositivo te guía paso a paso.</li>
            </ol>
            <p>
              <Link href="/" className="text-blue-600 hover:underline">
                Usa nuestro mapa interactivo
              </Link>{" "}
              para encontrar el desfibrilador más cercano en {regionName}, o{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                colabora añadiendo un DEA
              </Link>{" "}
              que no esté registrado.
            </p>
          </div>
        </section>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href={countryPath(country)}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todas las comunidades de {country.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
