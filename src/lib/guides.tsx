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
    title: "Â¿QuÃ© es un DEA? GuÃ­a completa sobre desfibriladores",
    metaTitle: "Â¿QuÃ© es un DEA? GuÃ­a completa sobre desfibriladores automÃ¡ticos",
    description:
      "Descubre quÃ© es un desfibrilador externo automÃ¡tico (DEA), cÃ³mo funciona, quiÃ©n puede usarlo y por quÃ© es vital en emergencias cardÃ­acas. GuÃ­a completa actualizada.",
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
          "SÃ­. Los DEA estÃ¡n diseÃ±ados para ser usados por cualquier persona, incluso sin formaciÃ³n mÃ©dica. El dispositivo da instrucciones de voz paso a paso y solo administra la descarga si detecta un ritmo cardÃ­aco que lo necesita. En EspaÃ±a, la legislaciÃ³n varÃ­a por comunidad autÃ³noma, pero en una emergencia vital, cualquier persona puede y debe usarlo.",
      },
      {
        question: "Â¿CuÃ¡nto cuesta un desfibrilador DEA?",
        answer:
          "El precio de un DEA varÃ­a entre 800 â‚¬ y 2.500 â‚¬ dependiendo del modelo y fabricante. Los modelos mÃ¡s habituales en espacios pÃºblicos en EspaÃ±a (como Philips HeartStart, Zoll AED 3 o LIFEPAK CR2) cuestan entre 1.200 â‚¬ y 1.800 â‚¬. AdemÃ¡s hay que sumar el mantenimiento anual (parches y baterÃ­a).",
      },
      {
        question: "Â¿CuÃ¡l es la diferencia entre un DEA y un DESA?",
        answer:
          "DEA (Desfibrilador Externo AutomÃ¡tico) y DESA (Desfibrilador Externo SemiautomÃ¡tico) son prÃ¡cticamente lo mismo. La diferencia es que el DEA administra la descarga automÃ¡ticamente cuando detecta fibrilaciÃ³n, mientras que el DESA requiere que el usuario pulse un botÃ³n. En la prÃ¡ctica, la mayorÃ­a de dispositivos instalados en EspaÃ±a son DESA, aunque coloquialmente se les llama DEA.",
      },
    ],
    content: () => (
      <>
        <p>
          Un <strong>DEA (Desfibrilador Externo AutomÃ¡tico)</strong> es un dispositivo mÃ©dico
          portÃ¡til que analiza el ritmo cardÃ­aco de una persona y, si detecta una arritmia
          potencialmente mortal como la fibrilaciÃ³n ventricular, administra una descarga elÃ©ctrica
          controlada para restablecer el ritmo normal del corazÃ³n.
        </p>

        <h2>Â¿CÃ³mo funciona un desfibrilador?</h2>
        <p>
          El DEA funciona en tres pasos sencillos que el propio dispositivo guÃ­a mediante
          instrucciones de voz:
        </p>
        <ol>
          <li>
            <strong>ColocaciÃ³n de electrodos:</strong> Se pegan dos parches adhesivos en el pecho
            desnudo de la vÃ­ctima (el DEA indica exactamente dÃ³nde).
          </li>
          <li>
            <strong>AnÃ¡lisis del ritmo:</strong> El dispositivo analiza automÃ¡ticamente el ritmo
            cardÃ­aco y determina si es necesaria una descarga.
          </li>
          <li>
            <strong>Descarga (si necesaria):</strong> Solo si detecta fibrilaciÃ³n ventricular o
            taquicardia ventricular sin pulso, el DEA carga y administra la descarga. Si el ritmo no
            lo requiere, el dispositivo no descarga aunque se pulse el botÃ³n.
          </li>
        </ol>

        <h2>Â¿Por quÃ© son tan importantes los DEA?</h2>
        <p>
          En EspaÃ±a se producen aproximadamente <strong>30.000 paradas cardÃ­acas al aÃ±o</strong>{" "}
          fuera del Ã¡mbito hospitalario. La tasa de supervivencia sin desfibrilaciÃ³n temprana es
          inferior al 5%. Sin embargo, si se aplica un DEA en los primeros 3-5 minutos, la tasa de
          supervivencia puede superar el 70%.
        </p>
        <p>
          <strong>
            Por cada minuto que pasa sin desfibrilaciÃ³n, las posibilidades de supervivencia
            disminuyen un 10%.
          </strong>{" "}
          Esto hace que saber dÃ³nde estÃ¡ el DEA mÃ¡s cercano sea literalmente una cuestiÃ³n de
          vida o muerte.
        </p>

        <h2>Â¿DÃ³nde se encuentran los DEA?</h2>
        <p>Los DEA se instalan habitualmente en:</p>
        <ul>
          <li>Centros comerciales y grandes superficies</li>
          <li>Estaciones de tren y metro</li>
          <li>Aeropuertos</li>
          <li>Instalaciones deportivas y gimnasios</li>
          <li>Edificios pÃºblicos (ayuntamientos, bibliotecas)</li>
          <li>Centros educativos</li>
          <li>Empresas con mÃ¡s de 50 trabajadores</li>
          <li>Comunidades de vecinos</li>
        </ul>
        <p>
          Puedes encontrar todos los DEA registrados en EspaÃ±a en nuestro{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa interactivo de desfibriladores
          </Link>
          .
        </p>

        <h2>LegislaciÃ³n sobre DEA en EspaÃ±a</h2>
        <p>
          En EspaÃ±a, la regulaciÃ³n sobre desfibriladores es competencia de cada comunidad
          autÃ³noma. La mayorÃ­a de comunidades han aprobado decretos que obligan a instalar DEA en
          determinados espacios pÃºblicos y establecimientos. Consulta nuestra{" "}
          <Link href="/guia/normativa-dea-espana" className="text-blue-600 hover:underline">
            guÃ­a sobre normativa DEA por comunidad autÃ³noma
          </Link>{" "}
          para mÃ¡s detalles.
        </p>
      </>
    ),
  },
  {
    slug: "como-usar-desfibrilador",
    title: "CÃ³mo usar un desfibrilador: guÃ­a paso a paso",
    metaTitle: "CÃ³mo usar un desfibrilador (DEA): guÃ­a paso a paso con instrucciones",
    description:
      "Aprende a usar un desfibrilador DEA paso a paso. Instrucciones claras para actuar en una emergencia cardÃ­aca, desde llamar al 112 hasta aplicar la descarga.",
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
        question: "Â¿Puedo hacer daÃ±o a alguien usando un DEA?",
        answer:
          "No. El DEA solo administra una descarga si detecta un ritmo cardÃ­aco que lo necesita (fibrilaciÃ³n ventricular o taquicardia ventricular sin pulso). Si el corazÃ³n tiene un ritmo normal o estÃ¡ en asistolia, el dispositivo NO descargarÃ¡ aunque se pulse el botÃ³n. Es imposible hacer daÃ±o con un DEA usado correctamente.",
      },
      {
        question: "Â¿Necesito formaciÃ³n para usar un DEA?",
        answer:
          "No es imprescindible. Los DEA estÃ¡n diseÃ±ados para ser usados por personas sin formaciÃ³n mÃ©dica. El dispositivo da instrucciones de voz claras. Sin embargo, se recomienda hacer un curso de primeros auxilios y RCP para estar mejor preparado. Muchos ayuntamientos y Cruz Roja ofrecen cursos gratuitos.",
      },
      {
        question: "Â¿QuÃ© hago si el DEA dice 'descarga no recomendada'?",
        answer:
          "Significa que el ritmo cardÃ­aco de la vÃ­ctima no requiere descarga en ese momento. Debes continuar con las compresiones torÃ¡cicas (RCP) y seguir las instrucciones del DEA. El dispositivo volverÃ¡ a analizar el ritmo cada 2 minutos y recomendarÃ¡ descarga si es necesario.",
      },
    ],
    content: () => (
      <>
        <p>
          Usar un desfibrilador puede salvar una vida. Aunque nunca hayas recibido formaciÃ³n, los
          DEA estÃ¡n diseÃ±ados para guiarte paso a paso con instrucciones de voz claras. Esta guÃ­a
          te prepara para actuar con confianza en una emergencia.
        </p>

        <h2>Antes de todo: reconoce la emergencia</h2>
        <p>Una persona necesita un DEA cuando:</p>
        <ul>
          <li>EstÃ¡ inconsciente (no responde cuando le hablas o tocas)</li>
          <li>No respira o respira de forma anormal (boqueadas, jadeos)</li>
          <li>No tiene pulso (si sabes comprobarlo)</li>
        </ul>

        <h2>Paso 1: Llama al 112</h2>
        <p>
          <strong>Lo primero siempre es llamar al 112.</strong> Pon el telÃ©fono en altavoz para
          poder seguir actuando. El operador te guiarÃ¡ y enviarÃ¡ una ambulancia. Si hay mÃ¡s
          personas, pide a una que llame mientras tÃº atiendes a la vÃ­ctima.
        </p>

        <h2>Paso 2: Inicia la RCP (ReanimaciÃ³n Cardiopulmonar)</h2>
        <p>Mientras alguien busca el DEA mÃ¡s cercano, comienza las compresiones torÃ¡cicas:</p>
        <ol>
          <li>Coloca a la vÃ­ctima boca arriba sobre una superficie dura</li>
          <li>Pon el talÃ³n de una mano en el centro del pecho (entre los pezones)</li>
          <li>Coloca la otra mano encima entrelazando los dedos</li>
          <li>
            Comprime fuerte y rÃ¡pido:{" "}
            <strong>5-6 cm de profundidad, 100-120 compresiones por minuto</strong>
          </li>
          <li>
            Si sabes hacer ventilaciones: 30 compresiones + 2 ventilaciones. Si no, solo
            compresiones
          </li>
        </ol>

        <h2>Paso 3: Enciende el DEA</h2>
        <p>
          Cuando llegue el desfibrilador, Ã¡brelo y enciÃ©ndelo. La mayorÃ­a se encienden al abrir
          la tapa. El DEA comenzarÃ¡ a dar instrucciones de voz inmediatamente.
        </p>

        <h2>Paso 4: Coloca los electrodos</h2>
        <p>Los parches tienen dibujos que indican dÃ³nde colocarlos:</p>
        <ul>
          <li>
            <strong>Parche derecho:</strong> debajo de la clavÃ­cula derecha
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
          El DEA dirÃ¡ <em>&quot;Analizando ritmo, no toque al paciente&quot;</em>. AlÃ©jate y
          asegÃºrate de que nadie toca a la vÃ­ctima durante el anÃ¡lisis.
        </p>

        <h2>Paso 6: Sigue las instrucciones</h2>
        <p>
          Si el DEA recomienda descarga, dirÃ¡{" "}
          <em>&quot;Descarga recomendada, pulse el botÃ³n&quot;</em>. AsegÃºrate de que nadie toca a
          la vÃ­ctima y pulsa el botÃ³n. Si dice
          <em>&quot;Descarga no recomendada&quot;</em>, continÃºa con la RCP.
        </p>

        <h2>Paso 7: ContinÃºa hasta que llegue la ambulancia</h2>
        <p>
          DespuÃ©s de la descarga (o si no se recomienda), el DEA te pedirÃ¡ que continÃºes con la
          RCP durante 2 minutos. Luego volverÃ¡ a analizar. Sigue este ciclo hasta que llegue el
          equipo de emergencias o la vÃ­ctima recupere la consciencia.
        </p>

        <p>
          <strong>Encuentra el DEA mÃ¡s cercano a ti ahora mismo</strong> usando nuestro{" "}
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
    title: "Normativa sobre DEAs en EspaÃ±a por comunidad autÃ³noma",
    metaTitle: "Normativa sobre desfibriladores (DEA) en EspaÃ±a â€” LegislaciÃ³n por comunidad",
    description:
      "LegislaciÃ³n vigente sobre desfibriladores DEA en EspaÃ±a. Obligaciones de instalaciÃ³n, formaciÃ³n requerida y sanciones por comunidad autÃ³noma. Actualizado 2026.",
    keywords: [
      "normativa dea espaÃ±a",
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
          "Depende de la comunidad autÃ³noma y del tipo de establecimiento. La mayorÃ­a de comunidades obligan a instalar DEA en: instalaciones deportivas con aforo superior a 500 personas, centros comerciales grandes, estaciones de transporte, y edificios pÃºblicos. Consulta la normativa especÃ­fica de tu comunidad autÃ³noma.",
      },
      {
        question: "Â¿QuÃ© multa hay por no tener desfibrilador si es obligatorio?",
        answer:
          "Las sanciones varÃ­an por comunidad autÃ³noma. En general, las multas por no disponer de un DEA obligatorio oscilan entre 3.000 â‚¬ y 600.000 â‚¬ segÃºn la gravedad. CataluÃ±a y AndalucÃ­a son de las comunidades con sanciones mÃ¡s severas. AdemÃ¡s de la multa, puede haber responsabilidad civil en caso de fallecimiento.",
      },
      {
        question: "Â¿Necesito registrar mi desfibrilador?",
        answer:
          "SÃ­, en la mayorÃ­a de comunidades autÃ³nomas es obligatorio registrar el DEA ante la autoridad sanitaria competente. AdemÃ¡s, puedes registrarlo gratuitamente en DeaMap para que sea localizable por cualquier persona en caso de emergencia.",
      },
    ],
    content: () => (
      <>
        <p>
          En EspaÃ±a, la regulaciÃ³n sobre desfibriladores externos automÃ¡ticos (DEA) es
          competencia de cada <strong>comunidad autÃ³noma</strong>. No existe una ley nacional
          Ãºnica, lo que genera diferencias significativas en obligaciones, formaciÃ³n requerida y
          sanciones entre territorios.
        </p>

        <h2>Marco general</h2>
        <p>
          El Real Decreto 365/2009 estableciÃ³ las condiciones generales para el uso de DEA fuera
          del Ã¡mbito sanitario. Sin embargo, cada comunidad autÃ³noma ha desarrollado su propia
          normativa, que en muchos casos va mÃ¡s allÃ¡ del marco estatal.
        </p>

        <h2>Â¿DÃ³nde es obligatorio instalar un DEA?</h2>
        <p>
          Aunque varÃ­a por comunidad, los espacios donde mÃ¡s frecuentemente se exige la
          instalaciÃ³n de un DEA son:
        </p>
        <ul>
          <li>
            <strong>Instalaciones deportivas</strong> con aforo superior a 500 personas
          </li>
          <li>
            <strong>Centros comerciales</strong> de mÃ¡s de 2.500 mÂ²
          </li>
          <li>
            <strong>Estaciones de transporte</strong> (tren, metro, aeropuerto)
          </li>
          <li>
            <strong>Edificios pÃºblicos</strong> con gran afluencia
          </li>
          <li>
            <strong>Centros educativos</strong> (en algunas comunidades)
          </li>
          <li>
            <strong>Hoteles</strong> de mÃ¡s de 100 habitaciones (en algunas comunidades)
          </li>
        </ul>

        <h2>Normativa por comunidad autÃ³noma</h2>

        <h3>AndalucÃ­a</h3>
        <p>
          Decreto 22/2012. Obligatorio en instalaciones deportivas, centros comerciales, centros de
          trabajo de mÃ¡s de 250 personas y establecimientos de ocio con aforo superior a 500.
          Requiere formaciÃ³n acreditada. Sanciones de hasta 600.000 â‚¬.
        </p>

        <h3>CataluÃ±a</h3>
        <p>
          Decreto 151/2012. Una de las normativas mÃ¡s exigentes. Obligatorio en centros comerciales
          de mÃ¡s de 2.500 mÂ², estaciones de transporte, instalaciones deportivas y centros
          educativos. Se exige formaciÃ³n de 8 horas. Registro obligatorio.
        </p>

        <h3>Comunidad de Madrid</h3>
        <p>
          Decreto 78/2017. Obligatorio en centros comerciales, instalaciones deportivas con aforo
          superior a 500, estaciones de transporte y edificios de la administraciÃ³n pÃºblica.
          FormaciÃ³n recomendada pero no obligatoria para el uso.
        </p>

        <h3>PaÃ­s Vasco</h3>
        <p>
          Decreto 16/2005 (actualizado). Obligatorio en espacios pÃºblicos con gran afluencia.
          FormaciÃ³n obligatoria de al menos 4 horas. Registro ante Osakidetza.
        </p>

        <h3>Comunitat Valenciana</h3>
        <p>
          Decreto 159/2017. Obligatorio en numerosos espacios pÃºblicos y privados, incluyendo
          empresas de mÃ¡s de 250 trabajadores. FormaciÃ³n de 8 horas requerida.
        </p>

        <h3>Otras comunidades</h3>
        <p>
          Galicia, AragÃ³n, Castilla y LeÃ³n, Canarias y el resto de comunidades tienen tambiÃ©n sus
          propias normativas. En general, la tendencia es hacia una mayor obligatoriedad y
          regulaciÃ³n mÃ¡s estricta.
        </p>

        <h2>Mantenimiento obligatorio</h2>
        <p>
          Todas las normativas exigen un <strong>mantenimiento periÃ³dico</strong> del DEA que
          incluye:
        </p>
        <ul>
          <li>RevisiÃ³n mensual del estado del dispositivo y seÃ±alizaciÃ³n</li>
          <li>Control de caducidad de parches (generalmente cada 2 aÃ±os)</li>
          <li>Control de baterÃ­a (vida Ãºtil de 4-5 aÃ±os)</li>
          <li>Registro de cada uso del dispositivo</li>
        </ul>

        <p>
          Si tienes un DEA instalado, regÃ­stralo gratuitamente en{" "}
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
    title: "CardioprotecciÃ³n de espacios: obligaciones y buenas prÃ¡cticas",
    metaTitle: "CardioprotecciÃ³n de espacios â€” GuÃ­a de obligaciones y buenas prÃ¡cticas",
    description:
      "GuÃ­a completa sobre cardioprotecciÃ³n de espacios pÃºblicos y privados. Requisitos legales, cÃ³mo instalar un DEA, formaciÃ³n del personal y certificaciÃ³n.",
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
        question: "Â¿QuÃ© significa que un espacio estÃ© cardioprotegido?",
        answer:
          "Un espacio cardioprotegido es aquel que dispone de al menos un desfibrilador externo automÃ¡tico (DEA), personal formado en su uso y RCP, seÃ±alizaciÃ³n adecuada, y un plan de mantenimiento del dispositivo. Algunos espacios obtienen ademÃ¡s una certificaciÃ³n oficial de cardioprotecciÃ³n.",
      },
      {
        question: "Â¿CuÃ¡ntos desfibriladores necesita mi empresa?",
        answer:
          "La recomendaciÃ³n general es que un DEA estÃ© accesible en menos de 3 minutos desde cualquier punto del espacio. En edificios de varias plantas, esto suele implicar un DEA cada 2-3 plantas. En superficies grandes (centros comerciales, polÃ­gonos), se recomienda un DEA cada 200-300 metros de distancia recorrida.",
      },
      {
        question: "Â¿CuÃ¡nto cuesta cardioproteger un espacio?",
        answer:
          "El coste depende del tamaÃ±o del espacio y el nÃºmero de DEA necesarios. Un DEA cuesta entre 1.200 â‚¬ y 1.800 â‚¬, la vitrina entre 150 â‚¬ y 400 â‚¬, la seÃ±alizaciÃ³n unos 50-100 â‚¬, y la formaciÃ³n entre 50 â‚¬ y 150 â‚¬ por persona. El mantenimiento anual (parches + revisiÃ³n) ronda los 200-300 â‚¬ por dispositivo.",
      },
    ],
    content: () => (
      <>
        <p>
          La <strong>cardioprotecciÃ³n</strong> es el conjunto de medidas destinadas a garantizar
          una respuesta rÃ¡pida y eficaz ante una parada cardÃ­aca en un espacio determinado. Un
          espacio cardioprotegido dispone de desfibriladores, personal formado y protocolos de
          actuaciÃ³n que pueden salvar vidas en los primeros minutos crÃ­ticos.
        </p>

        <h2>Â¿Por quÃ© cardioproteger tu espacio?</h2>
        <p>
          Las paradas cardÃ­acas pueden ocurrir en cualquier lugar y momento. En EspaÃ±a, se
          producen aproximadamente{" "}
          <strong>30.000 paradas cardÃ­acas extrahospitalarias al aÃ±o</strong>. La supervivencia
          depende directamente del tiempo de respuesta:
        </p>
        <ul>
          <li>
            <strong>0-3 minutos:</strong> Tasa de supervivencia superior al 70%
          </li>
          <li>
            <strong>3-5 minutos:</strong> Supervivencia del 50%
          </li>
          <li>
            <strong>MÃ¡s de 10 minutos:</strong> Supervivencia inferior al 5%
          </li>
        </ul>
        <p>
          Una ambulancia tarda de media entre 8 y 15 minutos en llegar. Tener un DEA accesible en el
          propio espacio es la Ãºnica forma de actuar en los primeros minutos.
        </p>

        <h2>Elementos de un espacio cardioprotegido</h2>

        <h3>1. Desfibrilador (DEA/DESA)</h3>
        <p>
          El elemento central es un desfibrilador externo automÃ¡tico o semiautomÃ¡tico. Debe estar
          en una ubicaciÃ³n accesible, visible y seÃ±alizada. Se recomienda instalarlo en una
          vitrina con alarma para evitar robos y protegerlo de las condiciones ambientales.
        </p>

        <h3>2. SeÃ±alizaciÃ³n</h3>
        <p>
          La seÃ±alizaciÃ³n debe incluir el sÃ­mbolo internacional del DEA (corazÃ³n verde con rayo)
          y ser visible desde la distancia. Se colocan seÃ±ales en la entrada del edificio, en los
          accesos a la zona del DEA y junto al propio dispositivo.
        </p>

        <h3>3. FormaciÃ³n del personal</h3>
        <p>
          Aunque los DEA pueden ser usados sin formaciÃ³n, se recomienda que al menos el 10-20% del
          personal del espacio estÃ© formado en RCP y uso de DEA. La formaciÃ³n suele durar entre 4
          y 8 horas e incluye prÃ¡ctica con maniquÃ­es.
        </p>

        <h3>4. Plan de actuaciÃ³n</h3>
        <p>
          Un protocolo documentado que establece la cadena de actuaciÃ³n: quiÃ©n llama al 112,
          quiÃ©n va a buscar el DEA, quiÃ©n inicia la RCP, y cÃ³mo se coordina con los servicios de
          emergencia.
        </p>

        <h3>5. Mantenimiento</h3>
        <p>
          Revisiones periÃ³dicas del dispositivo, control de caducidad de parches y baterÃ­a, y
          registro de incidencias. La mayorÃ­a de DEA modernos realizan autocomprobaciones diarias y
          muestran el estado en un indicador visual.
        </p>

        <h2>Pasos para cardioproteger tu espacio</h2>
        <ol>
          <li>
            <strong>EvaluaciÃ³n:</strong> Analiza el tamaÃ±o del espacio, afluencia de personas,
            distancia al hospital mÃ¡s cercano y perfil de usuarios.
          </li>
          <li>
            <strong>Consulta normativa:</strong> Verifica si la{" "}
            <Link href="/guia/normativa-dea-espana" className="text-blue-600 hover:underline">
              normativa de tu comunidad autÃ³noma
            </Link>{" "}
            te obliga a instalar un DEA.
          </li>
          <li>
            <strong>AdquisiciÃ³n:</strong> Elige un DEA certificado (marca CE) adecuado para tu
            entorno. Incluye vitrina y seÃ±alizaciÃ³n.
          </li>
          <li>
            <strong>InstalaciÃ³n:</strong> Coloca el DEA en un punto accesible en menos de 3 minutos
            desde cualquier zona del espacio.
          </li>
          <li>
            <strong>FormaciÃ³n:</strong> Forma al personal en RCP y uso de DEA.
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
            <strong>Mantenimiento:</strong> Establece un calendario de revisiones periÃ³dicas.
          </li>
        </ol>

        <p>
          Consulta el{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            mapa de desfibriladores
          </Link>{" "}
          para ver quÃ© DEA hay ya registrados cerca de tu espacio. Si conoces un{" "}
          <Link href="/guia/que-es-un-dea" className="text-blue-600 hover:underline">
            DEA
          </Link>{" "}
          que no aparece en el mapa, ayÃºdanos a registrarlo.
        </p>
      </>
    ),
  },
];

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
