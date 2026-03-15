export default function JsonLd() {
  const webApp = {
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
    author: {
      "@type": "Organization",
      name: "Global Emergency",
      url: "https://www.globalemergency.online",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://deamap.es/?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es DeaMap?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DeaMap es una plataforma colaborativa que permite localizar desfibriladores (DEAs) cercanos en caso de emergencia cardíaca. Contamos con cobertura en España y planes de expansión a nivel europeo. Es un proyecto desarrollado por Global Emergency.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo funciona DeaMap?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Utiliza la búsqueda por ubicación o dirección para encontrar los DEAs más cercanos a ti. Cada DEA incluye información detallada sobre su ubicación, horarios de acceso y datos de contacto. También puedes usar tu geolocalización para encontrar el desfibrilador más cercano automáticamente.",
        },
      },
      {
        "@type": "Question",
        name: "¿Por qué es importante tener acceso rápido a un desfibrilador?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En una emergencia cardíaca, cada segundo cuenta. Por cada minuto que pasa sin desfibrilación, las posibilidades de supervivencia disminuyen un 10%. Tener acceso rápido a un desfibrilador puede salvar vidas. DeaMap facilita encontrar el equipo más cercano cuando más se necesita.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo puedo agregar un desfibrilador al mapa?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Si conoces la ubicación de un DEA que no está en el mapa, puedes agregarlo fácilmente a través del formulario en deamap.es/dea/new-simple. Solo necesitas el nombre del lugar y la dirección. Un administrador revisará y completará los datos posteriormente.",
        },
      },
      {
        "@type": "Question",
        name: "¿DeaMap tiene una API pública?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí, DeaMap ofrece una API REST pública y gratuita para consultar ubicaciones de desfibriladores. Puedes buscar DEAs cercanos por coordenadas, por ciudad, o consultar estadísticas. La documentación está disponible en deamap.es/api/docs.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
  );
}
