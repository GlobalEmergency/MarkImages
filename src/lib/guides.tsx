import Link from "next/link";
import type { ReactNode } from "react";

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  modifiedAt: string;
  faq: { question: string; answer: string }[];
  content: () => ReactNode;
  relatedCity?: string;
}

export const GUIDES: Guide[] = [
  {
    slug: "que-es-un-dea",
    title: "Â¿Qué es un DEA? Guía completa sobre desfibriladores",
    metaTitle: "Â¿Qué es un DEA? Guía completa sobre desfibriladores automáticos",
    description:
      "Descubre qué es un desfibrilador externo automático (DEA), cómo funciona, quién puede usarlo y por qué es vital en emergencias cardíacas. Guía completa actualizada.",
    keywords: [
      "que es un dea",
      "desfibrilador automatico externo",
      "dea desfibrilador",
      "para que sirve un desfibrilador",
    ],
    publishedAt: "2026-04-13",
    modifiedAt: "2026-04-13",
    relatedCity: "madrid",
    faq: [
      {
        question: "Â¿Puede cualquier persona usar un DEA?",
        answer:
          "Sí. Los DEA están diseñados para ser usados por cualquier persona, incluso sin formación médica. El dispositivo da instrucciones de voz paso a paso y solo administra la descarga si detecta un ritmo cardíaco que lo necesita. En España, la legislación varía por comunidad autónoma, pero en una emergencia vital, cualquier persona puede y debe usarlo.",
      },
      {
        question: "Â¿Cuánto cuesta un desfibrilador DEA?",
        answer:
          "El precio de un DEA varía entre 800 â‚¬ y 2.500 â‚¬ dependiendo del modelo y fabricante. Los modelos más habituales en espacios públicos en España (como Philips HeartStart, Zoll AED 3 o LIFEPAK CR2) cuestan entre 1.200 â‚¬ y 1.800 â‚¬. Además hay que sumar el mantenimiento anual (parches y batería).",
      },
      {
        question: "Â¿Cuál es la diferencia entre un DEA y un DESA?",
        answer:
          "DEA (Desfibrilador Externo Automático) y DESA (Desfibrilador Externo Semiautomático) son prácticamente lo mismo. La diferencia es que el DEA administra la descarga automáticamente cuando detecta fibrilación, mientras que el DESA requiere que el usuario pulse un botón. En la práctica, la mayoría de dispositivos instalados en España son DESA, aunque coloquialmente se les llama DEA.",
      },
    ],
    content: () => (
      <>
        <p>
          Un <strong>DEA (Desfibrilador Externo Automático)</strong> es un dispositivo médico
          portátil que analiza el ritmo cardíaco de una persona y, si detecta una arritmia
          potencialmente mortal como la fibrilación ventricular, administra una descarga eléctrica
          controlada para restablecer el ritmo normal del corazón.
        </p>

        <h2>Â¿Cómo funciona un desfibrilador?</h2>
        <p>
          El DEA funciona en tres pasos sencillos que el propio dispositivo guía mediante
          instrucciones de voz:
        </p>
        <ol>
          <li>
            <strong>Colocación de electrodos:</strong> Se pegan dos parches adhesivos en el pecho
            desnudo de la víctima (el DEA indica exactamente dónde).
          </li>
          <li>
            <strong>Análisis del ritmo:</strong> El dispositivo analiza automáticamente el ritmo
            cardíaco y determina si es necesaria una descarga.
          </li>
          <li>
            <strong>Descarga (si necesaria):</strong> Solo si detecta fibrilación ventricular o
            taquicardia ventricular sin pulso, el DEA carga y administra la descarga. Si el ritmo no
            lo requiere, el dispositivo no descarga aunque se pulse el botón.
          </li>
        </ol>

        <h2>Â¿Por qué son tan importantes los DEA?</h2>
        <p>
          En España se producen aproximadamente <strong>30.000 paradas cardíacas al año</strong>{" "}
          fuera del ámbito hospitalario. La tasa de supervivencia sin desfibrilación temprana es
          inferior al 5%. Sin embargo, si se aplica un DEA en los primeros 3-5 minutos, la tasa de
          supervivencia puede superar el 70%.
        </p>
        <p>
          <strong>
            Por cada minuto que pasa sin desfibrilación, las posibilidades de supervivencia
            disminuyen un 10%.
          </strong>{" "}
          Esto hace que saber dónde está el DEA más cercano sea literalmente una cuestión de vida o
          muerte.
        </p>

        <h2>Â¿Dónde se encuentran los DEA?</h2>
        <p>Los DEA se instalan habitualmente en:</p>
        <ul>
          <li>Centros comerciales y grandes superficies</li>
          <li>Estaciones de tren y metro</li>
          <li>Aeropuertos</li>
          <li>Instalaciones deportivas y gimnasios</li>
          <li>Edificios públicos (ayuntamientos, bibliotecas)</li>
          <li>Centros educativos</li>
          <li>Empresas con más de 50 trabajadores</li>
          <li>Comunidades de vecinos</li>
        </ul>
        <p>
          Puedes encontrar todos los DEA registrados en España en nuestro{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa interactivo de desfibriladores
          </Link>
          .
        </p>

        <h2>Legislación sobre DEA en España</h2>
        <p>
          En España, la regulación sobre desfibriladores es competencia de cada comunidad autónoma.
          La mayoría de comunidades han aprobado decretos que obligan a instalar DEA en determinados
          espacios públicos y establecimientos. Consulta nuestra{" "}
          <Link href="/guia/normativa-dea-espana" className="text-blue-600 hover:underline">
            guía sobre normativa DEA por comunidad autónoma
          </Link>{" "}
          para más detalles.
        </p>
      </>
    ),
  },
  {
    slug: "como-usar-desfibrilador",
    title: "Cómo usar un desfibrilador: guía paso a paso",
    metaTitle: "Cómo usar un desfibrilador (DEA): guía paso a paso con instrucciones",
    description:
      "Aprende a usar un desfibrilador DEA paso a paso. Instrucciones claras para actuar en una emergencia cardíaca, desde llamar al 112 hasta aplicar la descarga.",
    keywords: [
      "como usar desfibrilador",
      "como funciona un dea",
      "instrucciones desfibrilador",
      "usar dea paso a paso",
    ],
    publishedAt: "2026-04-13",
    modifiedAt: "2026-04-13",
    faq: [
      {
        question: "Â¿Puedo hacer daño a alguien usando un DEA?",
        answer:
          "No. El DEA solo administra una descarga si detecta un ritmo cardíaco que lo necesita (fibrilación ventricular o taquicardia ventricular sin pulso). Si el corazón tiene un ritmo normal o está en asistolia, el dispositivo NO descargará aunque se pulse el botón. Es imposible hacer daño con un DEA usado correctamente.",
      },
      {
        question: "Â¿Necesito formación para usar un DEA?",
        answer:
          "No es imprescindible. Los DEA están diseñados para ser usados por personas sin formación médica. El dispositivo da instrucciones de voz claras. Sin embargo, se recomienda hacer un curso de primeros auxilios y RCP para estar mejor preparado. Muchos ayuntamientos y Cruz Roja ofrecen cursos gratuitos.",
      },
      {
        question: "Â¿Qué hago si el DEA dice 'descarga no recomendada'?",
        answer:
          "Significa que el ritmo cardíaco de la víctima no requiere descarga en ese momento. Debes continuar con las compresiones torácicas (RCP) y seguir las instrucciones del DEA. El dispositivo volverá a analizar el ritmo cada 2 minutos y recomendará descarga si es necesario.",
      },
    ],
    content: () => (
      <>
        <p>
          Usar un desfibrilador puede salvar una vida. Aunque nunca hayas recibido formación, los
          DEA están diseñados para guiarte paso a paso con instrucciones de voz claras. Esta guía te
          prepara para actuar con confianza en una emergencia.
        </p>

        <h2>Antes de todo: reconoce la emergencia</h2>
        <p>Una persona necesita un DEA cuando:</p>
        <ul>
          <li>Está inconsciente (no responde cuando le hablas o tocas)</li>
          <li>No respira o respira de forma anormal (boqueadas, jadeos)</li>
          <li>No tiene pulso (si sabes comprobarlo)</li>
        </ul>

        <h2>Paso 1: Llama al 112</h2>
        <p>
          <strong>Lo primero siempre es llamar al 112.</strong> Pon el teléfono en altavoz para
          poder seguir actuando. El operador te guiará y enviará una ambulancia. Si hay más
          personas, pide a una que llame mientras tú atiendes a la víctima.
        </p>

        <h2>Paso 2: Inicia la RCP (Reanimación Cardiopulmonar)</h2>
        <p>Mientras alguien busca el DEA más cercano, comienza las compresiones torácicas:</p>
        <ol>
          <li>Coloca a la víctima boca arriba sobre una superficie dura</li>
          <li>Pon el talón de una mano en el centro del pecho (entre los pezones)</li>
          <li>Coloca la otra mano encima entrelazando los dedos</li>
          <li>
            Comprime fuerte y rápido:{" "}
            <strong>5-6 cm de profundidad, 100-120 compresiones por minuto</strong>
          </li>
          <li>
            Si sabes hacer ventilaciones: 30 compresiones + 2 ventilaciones. Si no, solo
            compresiones
          </li>
        </ol>

        <h2>Paso 3: Enciende el DEA</h2>
        <p>
          Cuando llegue el desfibrilador, ábrelo y enciéndelo. La mayoría se encienden al abrir la
          tapa. El DEA comenzará a dar instrucciones de voz inmediatamente.
        </p>

        <h2>Paso 4: Coloca los electrodos</h2>
        <p>Los parches tienen dibujos que indican dónde colocarlos:</p>
        <ul>
          <li>
            <strong>Parche derecho:</strong> debajo de la clavícula derecha
          </li>
          <li>
            <strong>Parche izquierdo:</strong> en el costado izquierdo, debajo de la axila
          </li>
        </ul>
        <p>
          <strong>Importante:</strong> El pecho debe estar seco y descubierto. Si hay mucho vello,
          usa la cuchilla que incluye el kit del DEA para rasurar la zona.
        </p>

        <h2>Paso 5: Deja que el DEA analice</h2>
        <p>
          El DEA dirá <em>&quot;Analizando ritmo, no toque al paciente&quot;</em>. Aléjate y
          asegúrate de que nadie toca a la víctima durante el análisis.
        </p>

        <h2>Paso 6: Sigue las instrucciones</h2>
        <p>
          Si el DEA recomienda descarga, dirá{" "}
          <em>&quot;Descarga recomendada, pulse el botón&quot;</em>. Asegúrate de que nadie toca a
          la víctima y pulsa el botón. Si dice
          <em>&quot;Descarga no recomendada&quot;</em>, continúa con la RCP.
        </p>

        <h2>Paso 7: Continúa hasta que llegue la ambulancia</h2>
        <p>
          Después de la descarga (o si no se recomienda), el DEA te pedirá que continúes con la RCP
          durante 2 minutos. Luego volverá a analizar. Sigue este ciclo hasta que llegue el equipo
          de emergencias o la víctima recupere la consciencia.
        </p>

        <p>
          <strong>Encuentra el DEA más cercano a ti ahora mismo</strong> usando nuestro{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa de desfibriladores
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    slug: "normativa-dea-espana",
    title: "Normativa sobre DEAs en España por comunidad autónoma",
    metaTitle: "Normativa sobre desfibriladores (DEA) en España — Legislación por comunidad",
    description:
      "Legislación vigente sobre desfibriladores DEA en España. Obligaciones de instalación, formación requerida y sanciones por comunidad autónoma. Actualizado 2026.",
    keywords: [
      "normativa dea españa",
      "legislacion desfibriladores",
      "obligacion desfibrilador",
      "ley dea comunidades autonomas",
    ],
    publishedAt: "2026-04-13",
    modifiedAt: "2026-04-13",
    faq: [
      {
        question: "Â¿Es obligatorio tener un desfibrilador en mi negocio?",
        answer:
          "Depende de la comunidad autónoma y del tipo de establecimiento. La mayoría de comunidades obligan a instalar DEA en: instalaciones deportivas con aforo superior a 500 personas, centros comerciales grandes, estaciones de transporte, y edificios públicos. Consulta la normativa específica de tu comunidad autónoma.",
      },
      {
        question: "Â¿Qué multa hay por no tener desfibrilador si es obligatorio?",
        answer:
          "Las sanciones varían por comunidad autónoma. En general, las multas por no disponer de un DEA obligatorio oscilan entre 3.000 â‚¬ y 600.000 â‚¬ según la gravedad. Cataluña y Andalucía son de las comunidades con sanciones más severas. Además de la multa, puede haber responsabilidad civil en caso de fallecimiento.",
      },
      {
        question: "Â¿Necesito registrar mi desfibrilador?",
        answer:
          "Sí, en la mayoría de comunidades autónomas es obligatorio registrar el DEA ante la autoridad sanitaria competente. Además, puedes registrarlo gratuitamente en DeaMap para que sea localizable por cualquier persona en caso de emergencia.",
      },
    ],
    content: () => (
      <>
        <p>
          En España, la regulación sobre desfibriladores externos automáticos (DEA) es competencia
          de cada <strong>comunidad autónoma</strong>. No existe una ley nacional única, lo que
          genera diferencias significativas en obligaciones, formación requerida y sanciones entre
          territorios.
        </p>

        <h2>Marco general</h2>
        <p>
          El Real Decreto 365/2009 estableció las condiciones generales para el uso de DEA fuera del
          ámbito sanitario. Sin embargo, cada comunidad autónoma ha desarrollado su propia
          normativa, que en muchos casos va más allá del marco estatal.
        </p>

        <h2>Â¿Dónde es obligatorio instalar un DEA?</h2>
        <p>
          Aunque varía por comunidad, los espacios donde más frecuentemente se exige la instalación
          de un DEA son:
        </p>
        <ul>
          <li>
            <strong>Instalaciones deportivas</strong> con aforo superior a 500 personas
          </li>
          <li>
            <strong>Centros comerciales</strong> de más de 2.500 mÂ²
          </li>
          <li>
            <strong>Estaciones de transporte</strong> (tren, metro, aeropuerto)
          </li>
          <li>
            <strong>Edificios públicos</strong> con gran afluencia
          </li>
          <li>
            <strong>Centros educativos</strong> (en algunas comunidades)
          </li>
          <li>
            <strong>Hoteles</strong> de más de 100 habitaciones (en algunas comunidades)
          </li>
        </ul>

        <h2>Normativa por comunidad autónoma</h2>

        <h3>Andalucía</h3>
        <p>
          Decreto 22/2012. Obligatorio en instalaciones deportivas, centros comerciales, centros de
          trabajo de más de 250 personas y establecimientos de ocio con aforo superior a 500.
          Requiere formación acreditada. Sanciones de hasta 600.000 â‚¬.
        </p>

        <h3>Cataluña</h3>
        <p>
          Decreto 151/2012. Una de las normativas más exigentes. Obligatorio en centros comerciales
          de más de 2.500 mÂ², estaciones de transporte, instalaciones deportivas y centros
          educativos. Se exige formación de 8 horas. Registro obligatorio.
        </p>

        <h3>Comunidad de Madrid</h3>
        <p>
          Decreto 78/2017. Obligatorio en centros comerciales, instalaciones deportivas con aforo
          superior a 500, estaciones de transporte y edificios de la administración pública.
          Formación recomendada pero no obligatoria para el uso.
        </p>

        <h3>País Vasco</h3>
        <p>
          Decreto 16/2005 (actualizado). Obligatorio en espacios públicos con gran afluencia.
          Formación obligatoria de al menos 4 horas. Registro ante Osakidetza.
        </p>

        <h3>Comunitat Valenciana</h3>
        <p>
          Decreto 159/2017. Obligatorio en numerosos espacios públicos y privados, incluyendo
          empresas de más de 250 trabajadores. Formación de 8 horas requerida.
        </p>

        <h3>Otras comunidades</h3>
        <p>
          Galicia, Aragón, Castilla y León, Canarias y el resto de comunidades tienen también sus
          propias normativas. En general, la tendencia es hacia una mayor obligatoriedad y
          regulación más estricta.
        </p>

        <h2>Mantenimiento obligatorio</h2>
        <p>
          Todas las normativas exigen un <strong>mantenimiento periódico</strong> del DEA que
          incluye:
        </p>
        <ul>
          <li>Revisión mensual del estado del dispositivo y señalización</li>
          <li>Control de caducidad de parches (generalmente cada 2 años)</li>
          <li>Control de batería (vida útil de 4-5 años)</li>
          <li>Registro de cada uso del dispositivo</li>
        </ul>

        <p>
          Si tienes un DEA instalado, regístralo gratuitamente en{" "}
          <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
            DeaMap
          </Link>{" "}
          para que sea localizable en emergencias. Consulta el{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa de desfibriladores
          </Link>{" "}
          para ver los DEA ya registrados en tu zona.
        </p>
      </>
    ),
  },
  {
    slug: "cardioproteccion-espacios",
    title: "Cardioprotección de espacios: obligaciones y buenas prácticas",
    metaTitle: "Cardioprotección de espacios — Guía de obligaciones y buenas prácticas",
    description:
      "Guía completa sobre cardioprotección de espacios públicos y privados. Requisitos legales, cómo instalar un DEA, formación del personal y certificación.",
    keywords: [
      "cardioproteccion",
      "espacios cardioprotegidos",
      "instalar desfibrilador",
      "cardioproteccion empresas",
    ],
    publishedAt: "2026-04-13",
    modifiedAt: "2026-04-13",
    faq: [
      {
        question: "Â¿Qué significa que un espacio esté cardioprotegido?",
        answer:
          "Un espacio cardioprotegido es aquel que dispone de al menos un desfibrilador externo automático (DEA), personal formado en su uso y RCP, señalización adecuada, y un plan de mantenimiento del dispositivo. Algunos espacios obtienen además una certificación oficial de cardioprotección.",
      },
      {
        question: "Â¿Cuántos desfibriladores necesita mi empresa?",
        answer:
          "La recomendación general es que un DEA esté accesible en menos de 3 minutos desde cualquier punto del espacio. En edificios de varias plantas, esto suele implicar un DEA cada 2-3 plantas. En superficies grandes (centros comerciales, polígonos), se recomienda un DEA cada 200-300 metros de distancia recorrida.",
      },
      {
        question: "Â¿Cuánto cuesta cardioproteger un espacio?",
        answer:
          "El coste depende del tamaño del espacio y el número de DEA necesarios. Un DEA cuesta entre 1.200 â‚¬ y 1.800 â‚¬, la vitrina entre 150 â‚¬ y 400 â‚¬, la señalización unos 50-100 â‚¬, y la formación entre 50 â‚¬ y 150 â‚¬ por persona. El mantenimiento anual (parches + revisión) ronda los 200-300 â‚¬ por dispositivo.",
      },
    ],
    content: () => (
      <>
        <p>
          La <strong>cardioprotección</strong> es el conjunto de medidas destinadas a garantizar una
          respuesta rápida y eficaz ante una parada cardíaca en un espacio determinado. Un espacio
          cardioprotegido dispone de desfibriladores, personal formado y protocolos de actuación que
          pueden salvar vidas en los primeros minutos críticos.
        </p>

        <h2>Â¿Por qué cardioproteger tu espacio?</h2>
        <p>
          Las paradas cardíacas pueden ocurrir en cualquier lugar y momento. En España, se producen
          aproximadamente <strong>30.000 paradas cardíacas extrahospitalarias al año</strong>. La
          supervivencia depende directamente del tiempo de respuesta:
        </p>
        <ul>
          <li>
            <strong>0-3 minutos:</strong> Tasa de supervivencia superior al 70%
          </li>
          <li>
            <strong>3-5 minutos:</strong> Supervivencia del 50%
          </li>
          <li>
            <strong>Más de 10 minutos:</strong> Supervivencia inferior al 5%
          </li>
        </ul>
        <p>
          Una ambulancia tarda de media entre 8 y 15 minutos en llegar. Tener un DEA accesible en el
          propio espacio es la única forma de actuar en los primeros minutos.
        </p>

        <h2>Elementos de un espacio cardioprotegido</h2>

        <h3>1. Desfibrilador (DEA/DESA)</h3>
        <p>
          El elemento central es un desfibrilador externo automático o semiautomático. Debe estar en
          una ubicación accesible, visible y señalizada. Se recomienda instalarlo en una vitrina con
          alarma para evitar robos y protegerlo de las condiciones ambientales.
        </p>

        <h3>2. Señalización</h3>
        <p>
          La señalización debe incluir el símbolo internacional del DEA (corazón verde con rayo) y
          ser visible desde la distancia. Se colocan señales en la entrada del edificio, en los
          accesos a la zona del DEA y junto al propio dispositivo.
        </p>

        <h3>3. Formación del personal</h3>
        <p>
          Aunque los DEA pueden ser usados sin formación, se recomienda que al menos el 10-20% del
          personal del espacio esté formado en RCP y uso de DEA. La formación suele durar entre 4 y
          8 horas e incluye práctica con maniquíes.
        </p>

        <h3>4. Plan de actuación</h3>
        <p>
          Un protocolo documentado que establece la cadena de actuación: quién llama al 112, quién
          va a buscar el DEA, quién inicia la RCP, y cómo se coordina con los servicios de
          emergencia.
        </p>

        <h3>5. Mantenimiento</h3>
        <p>
          Revisiones periódicas del dispositivo, control de caducidad de parches y batería, y
          registro de incidencias. La mayoría de DEA modernos realizan autocomprobaciones diarias y
          muestran el estado en un indicador visual.
        </p>

        <h2>Pasos para cardioproteger tu espacio</h2>
        <ol>
          <li>
            <strong>Evaluación:</strong> Analiza el tamaño del espacio, afluencia de personas,
            distancia al hospital más cercano y perfil de usuarios.
          </li>
          <li>
            <strong>Consulta normativa:</strong> Verifica si la{" "}
            <Link href="/guia/normativa-dea-espana" className="text-blue-600 hover:underline">
              normativa de tu comunidad autónoma
            </Link>{" "}
            te obliga a instalar un DEA.
          </li>
          <li>
            <strong>Adquisición:</strong> Elige un DEA certificado (marca CE) adecuado para tu
            entorno. Incluye vitrina y señalización.
          </li>
          <li>
            <strong>Instalación:</strong> Coloca el DEA en un punto accesible en menos de 3 minutos
            desde cualquier zona del espacio.
          </li>
          <li>
            <strong>Formación:</strong> Forma al personal en RCP y uso de DEA.
          </li>
          <li>
            <strong>Registro:</strong> Registra el DEA ante la autoridad sanitaria de tu comunidad y
            en{" "}
            <Link href="/dea/new-simple" className="text-blue-600 hover:underline">
              DeaMap
            </Link>
            .
          </li>
          <li>
            <strong>Mantenimiento:</strong> Establece un calendario de revisiones periódicas.
          </li>
        </ol>

        <p>
          Consulta el{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa de desfibriladores
          </Link>{" "}
          para ver qué DEA hay ya registrados cerca de tu espacio. Si conoces un{" "}
          <Link href="/guia/que-es-un-dea" className="text-blue-600 hover:underline">
            DEA
          </Link>{" "}
          que no aparece en el mapa, ayúdanos a registrarlo.
        </p>
      </>
    ),
  },
];

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
