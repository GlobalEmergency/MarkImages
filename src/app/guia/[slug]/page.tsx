import { ArrowLeft, BookOpen, Calendar } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GUIDES, GUIDE_BY_SLUG } from "@/lib/guides";

export const revalidate = 86400; // Revalidate daily

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDE_BY_SLUG.get(slug);

  if (!guide) {
    return { title: "Guía no encontrada | DeaMap" };
  }

  return {
    title: guide.metaTitle,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: `/guia/${slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      type: "article",
      url: `/guia/${slug}`,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.modifiedAt,
      images: [{ url: "/og-image.png", alt: guide.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.metaTitle,
      description: guide.description,
      images: ["/og-image.png"],
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDE_BY_SLUG.get(slug);

  if (!guide) notFound();

  const Content = guide.content;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.modifiedAt,
    author: {
      "@type": "Organization",
      name: "DeaMap",
      url: "https://deamap.es",
    },
    publisher: {
      "@type": "Organization",
      name: "DeaMap",
      url: "https://deamap.es",
      logo: {
        "@type": "ImageObject",
        url: "https://deamap.es/DeaMap_Logo.png",
      },
    },
    mainEntityOfPage: `https://deamap.es/guia/${slug}`,
    image: "https://deamap.es/og-image.png",
  };

  const faqLd =
    guide.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: guide.faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }
      : null;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "DeaMap", item: "https://deamap.es" },
      { "@type": "ListItem", position: 2, name: "Guías", item: "https://deamap.es/guia" },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: `https://deamap.es/guia/${slug}`,
      },
    ],
  };

  // Other guides for related links
  const otherGuides = GUIDES.filter((g) => g.slug !== slug);

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              DeaMap
            </Link>
            <span>/</span>
            <Link href="/guia/que-es-un-dea" className="hover:text-white transition-colors">
              Guías
            </Link>
            <span>/</span>
            <span className="text-white truncate">{guide.title}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{guide.title}</h1>
          <div className="flex items-center gap-4 text-blue-200 text-sm">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Actualizado:{" "}
              {new Date(guide.modifiedAt).toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <article className="container mx-auto px-4 max-w-3xl py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <div className="prose prose-gray prose-lg max-w-none">
            <Content />
          </div>
        </div>

        {/* FAQ Section */}
        {guide.faq.length > 0 && (
          <section className="mt-8 bg-white rounded-xl border border-gray-200 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas frecuentes</h2>
            <div className="space-y-6">
              {guide.faq.map((f, i) => (
                <details key={i} className="group" open={i === 0}>
                  <summary className="flex items-start gap-3 cursor-pointer list-none">
                    <span className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-gray-900 group-open:text-blue-600 transition-colors">
                      {f.question}
                    </span>
                  </summary>
                  <p className="mt-3 ml-9 text-gray-700 leading-relaxed">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related Guides */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Más guías
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {otherGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/guia/${g.slug}`}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all hover:border-blue-300 group"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">
                  {g.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white text-center">
          <h2 className="text-xl font-bold mb-2">Encuentra el desfibrilador más cercano</h2>
          <p className="text-blue-100 mb-4 text-sm">
            Mapa interactivo con desfibriladores en toda España
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Abrir mapa
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href="/locations"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Ver directorio de desfibriladores
          </Link>
        </div>
      </article>
    </div>
  );
}
