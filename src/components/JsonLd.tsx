export default function JsonLd() {
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "DeaMap",
    url: "https://deamap.es",
    description:
      "Encuentra desfibriladores cerca de ti en tiempo real. Mapa interactivo con mÃ¡s de 50.000 DEAs registrados en EspaÃ±a y en todo el mundo.",
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
        name: "Â¿QuÃ© es DeaMap?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DeaMap es una plataforma colaborativa que permite localizar desfibriladores (DEAs) cercanos en caso de emergencia cardÃ­aca. Contamos con mÃ¡s de 50.000 DEAs registrados en EspaÃ±a y en todo el mundo. Es un proyecto desarrollado por Global Emergency.",
        },
      },
      {
        "@type": "Question",
        name: "Â¿CÃ³mo funciona DeaMap?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Utiliza la bÃºsqueda por ubicaciÃ³n o direcciÃ³n para encontrar los DEAs mÃ¡s cercanos a ti. Cada DEA incluye informaciÃ³n detallada sobre su ubicaciÃ³n, horarios de acceso y datos de contacto. TambiÃ©n puedes usar tu geolocalizaciÃ³n para encontrar el desfibrilador mÃ¡s cercano automÃ¡ticamente.",
        },
      },
      {
        "@type": "Question",
        name: "Â¿Por quÃ© es importante tener acceso rÃ¡pido a un desfibrilador?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En una emergencia cardÃ­aca, cada segundo cuenta. Por cada minuto que pasa sin desfibrilaciÃ³n, las posibilidades de supervivencia disminuyen un 10%. Tener acceso rÃ¡pido a un desfibrilador puede salvar vidas. DeaMap facilita encontrar el equipo mÃ¡s cercano cuando mÃ¡s se necesita.",
        },
      },
      {
        "@type": "Question",
        name: "Â¿CÃ³mo puedo agregar un desfibrilador al mapa?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Si conoces la ubicaciÃ³n de un DEA que no estÃ¡ en el mapa, puedes agregarlo fÃ¡cilmente a travÃ©s del formulario en deamap.es/dea/new-simple. Solo necesitas el nombre del lugar y la direcciÃ³n. Un administrador revisarÃ¡ y completarÃ¡ los datos posteriormente.",
        },
      },
      {
        "@type": "Question",
        name: "Â¿DeaMap tiene una API pÃºblica?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SÃ­, DeaMap ofrece una API REST pÃºblica y gratuita para consultar ubicaciones de desfibriladores. Puedes buscar DEAs cercanos por coordenadas, por ciudad, o consultar estadÃ­sticas. La documentaciÃ³n estÃ¡ disponible en deamap.es/api/docs.",
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
