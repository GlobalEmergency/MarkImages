import { Globe, Heart, MapPin, ArrowRight, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  COMMUNITIES,
  COUNTRY_BY_SLUG,
  communityForIneCode,
  communityPath,
  cityPath,
} from "@/lib/geography";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ country: string }>;
}

interface CommunityStats {
  name: string;
  slug: string;
  totalAeds: number;
  cityCount: number;
}

async function getCountryStats(countryCode: string): Promise<{
  communities: CommunityStats[];
  totalAeds: number;
  totalCities: number;
}> {
  try {
    const raw = (await prisma.$queryRaw`
      SELECT LEFT(l.city_code, 2) as "ine_code", COUNT(*)::int as "aed_count",
             COUNT(DISTINCT l.city_name)::int as "city_count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.status = 'PUBLISHED'
        AND a.publication_mode != 'NONE'
        AND a.country_code = ${countryCode}
        AND l.city_code IS NOT NULL
        AND l.city_code != ''
      GROUP BY LEFT(l.city_code, 2)
    `) as { ine_code: string; aed_count: number; city_count: number }[];

    const communityAgg = new Map<string, { totalAeds: number; cityCount: number }>();

    for (const row of raw) {
      const community = communityForIneCode(row.ine_code);
      if (!community) continue;
      const existing = communityAgg.get(community.slug) || { totalAeds: 0, cityCount: 0 };
      existing.totalAeds += row.aed_count;
      existing.cityCount += row.city_count;
      communityAgg.set(community.slug, existing);
    }

    const communities: CommunityStats[] = COMMUNITIES.filter((c) => communityAgg.has(c.slug))
      .map((c) => {
        const stats = communityAgg.get(c.slug)!;
        return { name: c.name, slug: c.slug, ...stats };
      })
      .sort((a, b) => b.totalAeds - a.totalAeds);

    const totalAeds = communities.reduce((sum, c) => sum + c.totalAeds, 0);
    const totalCities = communities.reduce((sum, c) => sum + c.cityCount, 0);

    return { communities, totalAeds, totalCities };
  } catch {
    return { communities: [], totalAeds: 0, totalCities: 0 };
  }
}

export async function generateStaticParams() {
  return [{ country: "spain" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const country = COUNTRY_BY_SLUG.get(slug);
  if (!country) return { title: "País no encontrado | DeaMap" };

  const { totalAeds, totalCities, communities } = await getCountryStats(country.code);
  const title = `Desfibriladores en ${country.name} — ${totalAeds.toLocaleString("es-ES")} DEAs en ${totalCities} ciudades`;
  const description = `Directorio de ${totalAeds.toLocaleString("es-ES")} desfibriladores (DEA) en ${country.name}, distribuidos en ${communities.length} comunidades autónomas y ${totalCities} ciudades. Encuentra el más cercano.`;

  return {
    title,
    description,
    alternates: { canonical: `/locations/${slug}` },
    openGraph: {
      title,
      description,
      url: `/locations/${slug}`,
      images: [{ url: "/og-image.png" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  };
}

/**
 * Legacy redirect: /locations/madrid → /locations/spain/comunidad-de-madrid/madrid
 * When slug is not a known country, try to resolve it as a city name.
 */
async function tryLegacyCityRedirect(citySlug: string): Promise<never> {
  const cityName = decodeURIComponent(citySlug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const aed = await prisma.aed.findFirst({
    where: {
      status: "PUBLISHED",
      publication_mode: { not: "NONE" },
      location: {
        OR: [
          { city_name: { equals: cityName, mode: "insensitive" } },
          { city_name: { contains: cityName, mode: "insensitive" } },
        ],
      },
    },
    include: { location: { select: { city_name: true, city_code: true } } },
  });

  if (aed?.location?.city_code && aed.location.city_name) {
    const ineCode = aed.location.city_code.substring(0, 2);
    const community = communityForIneCode(ineCode);
    if (community) {
      redirect(cityPath("spain", community.slug, aed.location.city_name));
    }
  }

  notFound();
}

export default async function CountryPage({ params }: Props) {
  const { country: slug } = await params;
  const country = COUNTRY_BY_SLUG.get(slug);
  if (!country) {
    await tryLegacyCityRedirect(slug);
    notFound(); // unreachable — tryLegacyCityRedirect always redirects or calls notFound
  }

  const { communities, totalAeds, totalCities } = await getCountryStats(country.code);

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
        item: `https://deamap.es/locations/${slug}`,
      },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Desfibriladores en ${country.name} por comunidad autónoma`,
    numberOfItems: communities.length,
    itemListElement: communities.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://deamap.es${communityPath(slug, c.slug)}`,
      name: `Desfibriladores en ${c.name}`,
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }}
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
            <span className="text-white">{country.name}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">Desfibriladores en {country.name}</h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            Directorio completo de desfibriladores (DEA) por comunidad autónoma. Localiza el más
            cercano a tu ubicación.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalAeds.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-yellow-300" />
              <span className="font-semibold text-lg">{communities.length}</span>
              <span className="text-blue-200">comunidades</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-300" />
              <span className="font-semibold text-lg">{totalCities.toLocaleString("es-ES")}</span>
              <span className="text-blue-200">ciudades</span>
            </div>
          </div>
        </div>
      </section>

      {/* Community Grid */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Globe className="w-6 h-6 text-blue-600" />
          Comunidades Autónomas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <Link
              key={c.slug}
              href={communityPath(slug, c.slug)}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-all hover:border-blue-300 group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {c.name}
                </h3>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="flex gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-400" />
                  {c.totalAeds.toLocaleString("es-ES")} DEAs
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  {c.cityCount} ciudad{c.cityCount !== 1 ? "es" : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* SEO Content */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <h2>Mapa de desfibriladores en {country.name}</h2>
            <p>
              {country.name} cuenta con{" "}
              <strong>
                {totalAeds.toLocaleString("es-ES")} desfibriladores externos automáticos (DEA)
              </strong>{" "}
              registrados en DeaMap, distribuidos en{" "}
              <strong>{communities.length} comunidades autónomas</strong> y{" "}
              <strong>{totalCities} ciudades</strong>. Las comunidades con mayor cobertura son{" "}
              {communities.slice(0, 3).map((c, i) => (
                <span key={c.slug}>
                  {i > 0 && (i === 2 ? " y " : ", ")}
                  <Link
                    href={communityPath(slug, c.slug)}
                    className="text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>{" "}
                  ({c.totalAeds.toLocaleString("es-ES")} DEAs)
                </span>
              ))}
              .
            </p>
            <p>
              Un desfibrilador externo automático (DEA) es un dispositivo portátil que puede salvar
              vidas durante una parada cardíaca súbita. Por cada minuto sin desfibrilación, las
              posibilidades de supervivencia disminuyen un 10%.{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                Usa nuestro mapa interactivo
              </Link>{" "}
              para encontrar el desfibrilador más cercano, o{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                colabora añadiendo un DEA
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
