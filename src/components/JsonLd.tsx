export default function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "DeaMap",
    url: "https://deamap.es",
    description:
      "Localiza y verifica desfibriladores en tu zona. Mapa interactivo de DEAs en España con más de 30.000 desfibriladores registrados.",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    inLanguage: "es",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    aggregateRating: undefined,
    author: {
      "@type": "Organization",
      name: "DeaMap",
      url: "https://deamap.es",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://deamap.es/?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
