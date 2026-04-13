import { Heart, MapPin, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/db";
import { safeJsonLd } from "@/lib/json-ld";
import { PROVINCES, PROVINCE_BY_SLUG, toSlug } from "@/lib/provinces";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ province: string }>;
}

interface CityInProvince {
  city_name: string;
  count: number;
}

const getProvinceCities = cache(async (ineCode: string): Promise<CityInProvince[]> => {
  try {
    return (await prisma.$queryRaw`
      SELECT l.city_name, COUNT(*)::int as "count"
      FROM aeds a
      JOIN aed_locations l ON l.id = a.location_id
      WHERE a.publication_mode != 'NONE'
        AND a.published_at IS NOT NULL
        AND l.city_name IS NOT NULL
        AND l.city_name != ''
        AND l.city_code IS NOT NULL
        AND LEFT(l.city_code, 2) = ${ineCode}
      GROUP BY l.city_name
      ORDER BY COUNT(*) DESC
    `) as CityInProvince[];
  } catch {
    return [];
  }
});

export async function generateStaticParams() {
  return PROVINCES.map((p) => ({ province: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province: slug } = await params;
  const province = PROVINCE_BY_SLUG.get(slug);

  if (!province) {
    return { title: "Provincia no encontrada | DeaMap" };
  }

  const cities = await getProvinceCities(province.ineCode);
  const totalCount = cities.reduce((sum, c) => sum + c.count, 0);

  const title = `Desfibriladores en ${province.name} — ${totalCount} DEAs en ${cities.length} municipios`;
  const description = `Encuentra ${totalCount} desfibriladores (DEA) en la provincia de ${province.name} (${province.community}). Directorio por municipio con ubicaciones y horarios.`;

  return {
    title,
    description,
    alternates: { canonical: `/locations/provincia/${slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/locations/provincia/${slug}`,
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

export default async function ProvincePage({ params }: Props) {
  const { province: slug } = await params;
  const province = PROVINCE_BY_SLUG.get(slug);

  if (!province) notFound();

  const cities = await getProvinceCities(province.ineCode);
  const totalCount = cities.reduce((sum, c) => sum + c.count, 0);

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
        name: province.name,
        item: `https://deamap.es/locations/provincia/${slug}`,
      },
    ],
  };

  const itemListLd =
    cities.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Desfibriladores en ${province.name} por municipio`,
          numberOfItems: cities.length,
          itemListElement: cities.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://deamap.es/locations/${toSlug(c.city_name)}`,
            name: `Desfibriladores en ${c.city_name}`,
          })),
        }
      : null;

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
            <span className="text-white">{province.name}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Desfibriladores en {province.name}
          </h1>
          <p className="text-xl text-blue-100 mb-6 max-w-2xl">
            {totalCount > 0
              ? `${totalCount} desfibriladores (DEA) en ${cities.length} municipio${cities.length !== 1 ? "s" : ""} de la provincia de ${province.name}, ${province.community}.`
              : `Directorio de desfibriladores en la provincia de ${province.name}, ${province.community}. Próximamente con datos actualizados.`}
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-300" />
              <span className="font-semibold text-lg">{totalCount}</span>
              <span className="text-blue-200">DEAs registrados</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-300" />
              <span className="font-semibold text-lg">{cities.length}</span>
              <span className="text-blue-200">municipios</span>
            </div>
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

      {/* City List */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        {cities.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cities.map(({ city_name, count }) => (
              <Link
                key={city_name}
                href={`/locations/${toSlug(city_name)}`}
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
              Aún no hay desfibriladores registrados en {province.name}
            </h2>
            <p className="text-gray-500 mb-6">
              Estamos ampliando nuestra cobertura. Si conoces la ubicación de un DEA en{" "}
              {province.name}, puedes añadirlo.
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

        {/* SEO Content */}
        <section className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <h2>Desfibriladores (DEA) en la provincia de {province.name}</h2>
            <p>
              La provincia de {province.name}, perteneciente a {province.community}, cuenta con{" "}
              <strong>{totalCount} desfibriladores externos automáticos (DEA)</strong> registrados
              en DeaMap
              {cities.length > 0 && (
                <>
                  , distribuidos en{" "}
                  <strong>
                    {cities.length} municipio{cities.length !== 1 ? "s" : ""}
                  </strong>
                </>
              )}
              . Estos dispositivos son esenciales para atender paradas cardíacas y pueden aumentar
              significativamente las posibilidades de supervivencia si se utilizan en los primeros
              minutos.
            </p>
            <p>
              <Link href="/" className="text-blue-600 hover:underline">
                Usa nuestro mapa interactivo
              </Link>{" "}
              para encontrar el desfibrilador más cercano en {province.name}, o{" "}
              <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
                colabora añadiendo un DEA
              </Link>{" "}
              que no esté registrado.
            </p>
            <h3>¿Qué hacer en caso de emergencia cardíaca en {province.name}?</h3>
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
          </div>
        </section>

        {/* Links */}
        <div className="mt-8 text-center">
          <Link
            href="/locations"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todas las provincias y ciudades
          </Link>
        </div>
      </div>
    </div>
  );
}
