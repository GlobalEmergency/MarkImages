import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";

import DeaDetailClient from "./DeaDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const aed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: true,
        images: {
          where: { is_verified: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
    });

    if (!aed || aed.publication_mode === "NONE") {
      return {
        title: "Desfibrilador no encontrado",
        robots: { index: false },
      };
    }

    const filtered = filterAedByPublicationMode(aed);
    if (!filtered) {
      return {
        title: "Desfibrilador no encontrado",
        robots: { index: false },
      };
    }

    const locationParts: string[] = [];
    if (filtered.location?.street_name) {
      const street = [
        filtered.location.street_type,
        filtered.location.street_name,
        filtered.location.street_number,
      ]
        .filter(Boolean)
        .join(" ");
      locationParts.push(street);
    }
    if (filtered.location?.city_name) locationParts.push(filtered.location.city_name);
    if (filtered.location?.district_name) locationParts.push(filtered.location.district_name);

    const locationStr = locationParts.join(", ");
    const title = `Desfibrilador ${filtered.name}${locationStr ? ` en ${locationStr}` : ""}`;
    const description = `Desfibrilador (DEA) ${filtered.name}${locationStr ? ` ubicado en ${locationStr}` : ""}. Encuentra desfibriladores cercanos y cómo llegar en DeaMap.`;

    const imageUrl =
      aed.images?.[0]?.processed_url || aed.images?.[0]?.original_url || "/og-image.png";

    return {
      title,
      description,
      robots: { index: false, follow: true },
      alternates: {
        canonical: `/dea/${id}`,
      },
      openGraph: {
        title,
        description,
        type: "article",
        url: `/dea/${id}`,
        images: [
          {
            url: imageUrl,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: "Desfibrilador | DeaMap",
    };
  }
}

async function getPlaceJsonLd(id: string) {
  try {
    const aed = await prisma.aed.findUnique({
      where: { id },
      include: { location: true, schedule: true },
    });

    if (!aed || aed.publication_mode === "NONE" || !aed.location) return null;

    const loc = aed.location;
    const address = [loc.street_type, loc.street_name, loc.street_number].filter(Boolean).join(" ");

    return {
      "@context": "https://schema.org",
      "@type": "Place",
      name: aed.name,
      description: `Desfibrilador externo automático (DEA) en ${loc.city_name || "España"}`,
      ...(aed.latitude && aed.longitude
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude: aed.latitude,
              longitude: aed.longitude,
            },
          }
        : {}),
      address: {
        "@type": "PostalAddress",
        ...(address ? { streetAddress: address } : {}),
        ...(loc.city_name ? { addressLocality: loc.city_name } : {}),
        ...(loc.postal_code ? { postalCode: loc.postal_code } : {}),
        addressCountry: "ES",
      },
      additionalType: "https://schema.org/EmergencyService",
      isAccessibleForFree: true,
      ...(aed.schedule?.has_24h_surveillance ? { openingHours: "Mo-Su 00:00-23:59" } : {}),
    };
  } catch {
    return null;
  }
}

export default async function DeaDetailPage({ params }: Props) {
  const { id } = await params;
  const jsonLd = await getPlaceJsonLd(id);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <DeaDetailClient />
    </>
  );
}
