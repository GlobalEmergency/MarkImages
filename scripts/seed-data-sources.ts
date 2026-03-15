/**
 * Script para crear/actualizar las fuentes de datos externas via API.
 *
 * Uso:
 *   npx tsx scripts/seed-data-sources.ts
 *
 * Variables de entorno opcionales:
 *   BASE_URL        (default: http://localhost:3000)
 *   AUTH_TOKEN       JWT token (skip login if provided)
 *   ADMIN_EMAIL     (default: admin@deamap.es)
 *   ADMIN_PASSWORD  (default: 123456)
 *
 * El script:
 *   1. Autentica con el endpoint /api/auth/login (o usa AUTH_TOKEN)
 *   2. Obtiene las fuentes de datos existentes (GET /api/admin/data-sources)
 *   3. Para cada definición: POST si no existe, PUT si ya existe
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@deamap.es";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

// ============================================================
// Data source definitions (consolidated final configs)
// ============================================================

interface DataSourceDef {
  name: string;
  description: string;
  type: "CSV_FILE" | "CKAN_API" | "JSON_FILE" | "REST_API";
  sourceOrigin: string;
  countryCode: string;
  regionCode: string;
  matchingStrategy: string;
  matchingThreshold: number;
  isActive: boolean;
  syncFrequency: string;
  autoDeactivateMissing: boolean;
  autoUpdateFields: string[];
  defaultPublicationMode: string;
  config: Record<string, unknown>;
}

const DATA_SOURCES: DataSourceDef[] = [
  // ============================================================
  // 1. Comunidad de Madrid — JSON file (datos.comunidad.madrid)
  // ============================================================
  {
    name: "DEAs Comunidad de Madrid",
    description:
      "Desfibriladores externos fuera del ámbito sanitario — Datos abiertos Comunidad de Madrid",
    type: "JSON_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-MD",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://datos.comunidad.madrid/catalogo/dataset/d2478503-a4ae-4753-9540-9200071803c4/resource/42d08814-3361-4c2a-93fe-36664abc7953/download/desfibriladores_externos_fuera_ambito_sanitario.json",
      jsonPath: "data",
      fieldMappings: {
        codigo_dea: "externalId",
        direccion_via_codigo: "streetType",
        direccion_via_nombre: "streetName",
        direccion_portal_numero: "streetNumber",
        direccion_piso: "floor",
        direccion_puerta: "additionalInfo",
        direccion_ubicacion: "specificLocation",
        direccion_codigo_postal: "postalCode",
        direccion_latitud: "latitude",
        direccion_longitud: "longitude",
        municipio_codigo: "cityCode",
        municipio_nombre: "city",
        tipo_establecimiento: "establishmentType",
        tipo_titularidad: "ownershipType",
        horario_acceso: "accessSchedule",
      },
      fieldTransformers: {
        horario_acceso: ["spanish-schedule"],
      },
    },
  },

  // ============================================================
  // 2. Cataluña — Socrata SODA API
  // ============================================================
  {
    name: "DEAs Cataluña - Generalitat",
    description:
      "Registre de desfibril·ladors instal·lats a Catalunya fora de l'àmbit sanitari — Dades Obertes Generalitat de Catalunya (Socrata). ~11.700 registros.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-CT",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint: "https://analisi.transparenciacatalunya.cat/resource/wpud-ukyg.json",
      pagination: {
        strategy: "offset",
        limitParam: "$limit",
        limitValue: 1000,
        offsetParam: "$offset",
      },
      fieldMappings: {
        numero_inscripcio: "externalId",
        latitud: "latitude",
        longitud: "longitude",
        nom_centre: "name",
        tipus_via: "streetType",
        nom_via: "streetName",
        numero_via: "streetNumber",
        pis: "floor",
        porta: "additionalInfo",
        espai_fisic: "specificLocation",
        codi_postal: "postalCode",
        municipi: "city",
        provincia: "district",
        titular: "submitterName",
        fabricant: "deviceBrand",
        marca_model: "deviceModel",
        numero_serie: "deviceSerialNumber",
        vehicle: "observations",
        data_inscripcio: "deviceInstallationDate",
      },
    },
  },

  // ============================================================
  // 3. Castilla y León — OpenDataSoft API v2.1
  // Sin coordenadas GPS → requiere geocodificación
  // ============================================================
  {
    name: "DEAs Castilla y León - Junta",
    description:
      "Registro de DESA en espacios físicos — Datos abiertos Junta de Castilla y León (OpenDataSoft). ~2.500 registros. Sin coordenadas GPS, requiere geocodificación.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-CL",
    matchingStrategy: "BY_ADDRESS",
    matchingThreshold: 70,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint:
        "https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-desfibriladores-externos-semiautomaticos-desa-en-espacios-fisicos/records",
      responseDataPath: "results",
      pagination: {
        strategy: "offset",
        limitParam: "limit",
        limitValue: 100,
        offsetParam: "offset",
        totalCountPath: "total_count",
      },
      fieldMappings: {
        numero_serie: "deviceSerialNumber",
        empresa: "submitterName",
        ubicacion: "name",
        tipo_via: "streetType",
        via: "streetName",
        numero: "streetNumber",
        escalera: "additionalInfo", // Escalera (stairway)
        letra: "floor", // Letra / piso
        localidad: "city",
        provincia: "district",
        fecha_alta: "deviceInstallationDate",
        fecha_baja: "observations", // Fecha de baja (deregistration)
      },
      fieldTransformers: {
        via: ["nominatim-geocode"],
      },
    },
  },

  // ============================================================
  // 4. Euskadi — GeoJSON estático (opendata.euskadi.eus)
  // GeoJSON auto-detect extrae lat/lng de geometry.coordinates
  // ============================================================
  {
    name: "DEAs Euskadi - Gobierno Vasco",
    description:
      "Desfibriladores Externos Automatizados de Euskadi — Open Data Euskadi (GeoJSON). ~3.200 registros. 3 provincias: Bizkaia, Gipuzkoa, Araba/Álava.",
    type: "JSON_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-PV",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://opendata.euskadi.eus/contenidos/ds_localizaciones/desfibriladores/opendata/desfibriladores.geojson",
      fieldMappings: {
        codigo_dea: "externalId",
        direccion: "streetName",
        municipio: "city",
        provincia: "district",
        organismo: "name",
        ubicacion: "accessDescription",
        horario: "accessSchedule",
        numserie: "deviceSerialNumber",
        modelo: "deviceModel",
        latitude: "latitude",
        longitude: "longitude",
      },
      fieldTransformers: {
        horario: ["spanish-schedule"],
        direccion: ["libpostal-address"],
      },
    },
  },

  // ============================================================
  // 5. Galicia — CSV directo (Xunta de Galicia)
  // ~2.700 registros con coordenadas
  // ============================================================
  {
    name: "DEAs Galicia - Xunta",
    description:
      "Equipos DESA del 061 — Datos abiertos Xunta de Galicia (CSV). ~2.700 registros con coordenadas GPS.",
    type: "CSV_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-GA",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "CSV_FILE",
      fileUrl: "https://ficheiros-web.xunta.gal/abertos/desfibriladores/equipos-DESA-061.csv",
      encoding: "latin1", // Servidor sirve ISO-8859-1
      fieldMappings: {
        codequipo: "externalId",
        solicitante: "submitterName",
        ubicacion: "name",
        municipio: "city",
        provincia: "district",
        lat: "latitude",
        lon: "longitude",
        tipoInstalacion: "establishmentType",
        // CSV only has 8 columns; direccion, localidad, marca, modelo, nSerie no existen
      },
    },
  },

  // ============================================================
  // 6. Castellón — OpenDataSoft API v2 (Diputación Provincial)
  // 204 registros con coordenadas
  // ============================================================
  {
    name: "DEAs Castellón - Diputación",
    description:
      "Listado de desfibriladores de la provincia de Castellón — Diputación Provincial (OpenDataSoft). 204 registros.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "ES",
    regionCode: "ES-VC",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      // Export endpoint devuelve array plano (evita nesting ODS v2 records[].record.fields)
      apiEndpoint:
        "https://dipcas.opendatasoft.com/api/v2/catalog/datasets/listado_desfibriladores/exports/json",
      pagination: { strategy: "none" },
      fieldMappings: {
        nombre: "city",
        direccion_calle_num_y_cp: "streetName", // "Plaça X, 4" → transformer separa
        codigo_postal: "postalCode",
        intrucciones_de_localizacion: "accessDescription",
        // Solo 5 campos en la fuente; marca, modelo, n_serie, entidad_titular, tipo_espacio no existen
        // normalizeRecord aplana ubicacion:{lon,lat} → "ubicacion.lat", "ubicacion.lon"
        "ubicacion.lat": "latitude",
        "ubicacion.lon": "longitude",
      },
      fieldTransformers: {
        direccion_calle_num_y_cp: ["address-number-split"],
      },
    },
  },

  // ============================================================
  // 7. Málaga — GeoJSON (Ayuntamiento, datos abiertos)
  // ~549 registros con coordenadas (CSV bloqueado 403, usar GeoJSON)
  // ============================================================
  {
    name: "DEAs Málaga - Ayuntamiento",
    description:
      "Desfibriladores de la ciudad de Málaga — Datos abiertos Ayuntamiento (GeoJSON EPSG:4326). ~549 registros.",
    type: "JSON_FILE",
    sourceOrigin: "EXTERNAL_API",
    countryCode: "ES",
    regionCode: "ES-AN",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://datosabiertos.malaga.eu/dataset/a455c822-e695-4fc4-abc9-b18f50a59a3a/resource/467c375a-8a74-40d7-a765-d5d160e13fe3/download/da_desfibriladores-4326.geojson",
      // GeoJSON auto-detect extrae properties + geometry.coordinates
      fieldMappings: {
        id: "externalId",
        descripcion: "name", // nombre es ID interno (DEA_243), descripcion es el nombre real
        direccion: "streetName", // "AVENIDA X, 164" → transformer separa calle + número
        horarios: "accessSchedule",
        titularidad: "establishmentType", // MUNICIPAL, PRIVADA, etc. = tipo de establecimiento
        tlfcontacto: "submitterPhone", // TODO: migrar a ownerPhone cuando exista en el modelo
        email: "submitterEmail", // TODO: migrar a ownerEmail
        contacto: "submitterName", // TODO: migrar a ownerName
        accesopmr: "isPmrAccessible", // "Sí"/"No" — accesible PMR (movilidad reducida)
        infoesp: "additionalInfo", // Información especial
        VEINTICUATROHORAS: "has24hSurveillance",
        ubicacion: "specificLocation",
        latitude: "latitude",
        longitude: "longitude",
      },
      fieldTransformers: {
        horarios: ["spanish-schedule"],
        direccion: ["address-number-split"],
      },
    },
  },

  // ============================================================
  // 8. Santa Cruz de Tenerife — GeoJSON estático
  // 78 registros con coordenadas
  // ============================================================
  {
    name: "DEAs Santa Cruz de Tenerife - Ayuntamiento",
    description:
      "Desfibriladores de Santa Cruz de Tenerife — Datos abiertos Ayuntamiento (GeoJSON). 78 registros.",
    type: "JSON_FILE",
    sourceOrigin: "EXTERNAL_API",
    countryCode: "ES",
    regionCode: "ES-CN",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://www.santacruzdetenerife.es/opendata/dataset/653a11bc-4137-45d0-93be-547795a5cff9/resource/ebb1a959-677b-444b-8230-254ca1701424/download/desfibriladores.geojson",
      fieldMappings: {
        GEOCODIGO: "externalId",
        UBICACION: "name", // "NOMBRE: ubicación específica" → transformer separa
        // GRAD_X = longitude, GRAD_Y = latitude (nombres contraintuitivos)
        GRAD_Y: "latitude",
        GRAD_X: "longitude",
        // GeoJSON auto-detect también extrae coords de geometry.coordinates
        latitude: "latitude",
        longitude: "longitude",
      },
      fieldTransformers: {
        UBICACION: ["colon-name-split"],
      },
    },
  },

  // ============================================================
  // 9. Francia — GeoDAE Base Nacional (data.gouv.fr)
  // ~171.780 registros, API REST paginada
  // ============================================================
  {
    name: "DAE France - GeoDAE",
    description:
      "Base Nationale des Défibrillateurs (GeoDAE) — data.gouv.fr / Atlasanté. ~171.780 DAE en toda Francia. Actualización diaria.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "FR",
    regionCode: "FR",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "WEEKLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint:
        "https://tabular-api.data.gouv.fr/api/resources/edb6a9e1-2f16-4bbf-99e7-c3eb6b90794c/data/",
      responseDataPath: "data",
      pagination: {
        strategy: "page",
        pageParam: "page",
        limitParam: "page_size",
        limitValue: 200, // data.gouv.fr max page_size is 200
        totalCountPath: "meta.total",
      },
      fieldMappings: {
        c_gid: "externalId",
        c_nom: "name",
        c_lat_coor1: "latitude",
        c_long_coor1: "longitude",
        c_adr_num: "streetNumber",
        c_adr_voie: "streetName",
        c_com_cp: "postalCode",
        c_com_nom: "city",
        c_acc: "accessDescription",
        c_acc_complt: "specificLocation",
        c_acc_etg: "floor",
        // Horarios: c_disp_j=días, c_disp_h=horas (transformer lee horas del context)
        c_disp_h: "accessSchedule", // "{24h/24}", "{heures ouvrables}" — transformer reads this
        c_disp_complt: "additionalInfo", // Complemento de horario
        c_etat_fonct: "observations", // "En fonctionnement", "Hors service", etc.
        c_expt_rais: "submitterName",
        c_date_instal: "deviceInstallationDate",
        // Usar cc_photo (URL completa), no c_photo (solo filename)
        cc_photo1: "photo1Url",
        // Accesibilidad y disponibilidad
        c_acc_lib: "accessRestriction", // t="Accès libre" / f="Accès réservé"
        c_acc_acc: "isPmrAccessible", // t/f — PMR accessibility (movilidad reducida)
        c_dispsurv: "has24hSurveillance", // t/f — sous surveillance 24h
        c_dae_mobile: "isMobileUnit", // t/f — DAE mobile (ambulance, véhicule)
        // Mantenimiento y fechas del dispositivo
        c_dermnt: "deviceLastMaintenanceDate", // Dernière maintenance (NO es expiración)
        c_dtpr_bat: "deviceExpirationDate", // Date péremption batterie
        c_freq_mnt: "internalNotes", // Fréquence maintenance
      },
      fieldTransformers: {
        c_disp_j: ["french-schedule"],
      },
    },
  },

  // (Paris removed — fully covered by GeoDAE national dataset)

  // ============================================================
  // 10. Viena (Austria) — WFS GeoJSON
  // 797 registros con coordenadas
  // ============================================================
  {
    name: "AED Wien - Stadt Wien",
    description:
      "Defibrillatoren in Wien — Open Government Data Wien (WFS/GeoJSON). 797 AED. Campos ADRESSE y HINWEIS contienen HTML <br>.",
    type: "JSON_FILE",
    sourceOrigin: "EXTERNAL_API",
    countryCode: "AT",
    regionCode: "AT-9",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "JSON_FILE",
      fileUrl:
        "https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:DEFIBRILLATOROGD&srsName=EPSG:4326&outputFormat=json",
      // NO jsonPath → GeoJSON auto-detect flattens properties + extracts geometry.coordinates
      fieldMappings: {
        OBJECTID: "externalId",
        // ADRESSE contiene "10., Computerstraße 4 <br>e-shelter Rechenzentrum"
        // → vienna-address transformer extrae name, streetName, streetNumber, district
        ADRESSE: "name",
        BEZIRK: "district",
        STOCK: "floor",
        INFO: "accessDescription",
        HINWEIS: "accessSchedule",
        // GeoJSON auto-detect extrae lat/lon de geometry.coordinates
        latitude: "latitude",
        longitude: "longitude",
      },
      fieldTransformers: {
        ADRESSE: ["vienna-address"],
        HINWEIS: ["german-schedule"],
        INFO: ["html-strip"], // Limpia <br> de accessDescription
      },
    },
  },

  // ============================================================
  // 12. Basel-Stadt (Suiza) — OpenDataSoft API v2
  // 235 registros con coordenadas
  // ============================================================
  {
    name: "AED Basel-Stadt - Rettung",
    description:
      "Defibrillatoren in Basel-Stadt — Open Data Basel-Stadt (OpenDataSoft). 235 AED. Integrado con First Responder App.",
    type: "REST_API",
    sourceOrigin: "HEALTH_API",
    countryCode: "CH",
    regionCode: "CH-BS",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      // Usar export JSON que devuelve array directo (más simple que la v2 paginada)
      apiEndpoint: "https://data.bs.ch/api/v2/catalog/datasets/100019/exports/json",
      externalIdField: "id_df",
      pagination: {
        strategy: "none",
      },
      fieldMappings: {
        id_df: "externalId",
        standort: "name",
        strasse: "streetName",
        hausnummer: "streetNumber",
        plz: "postalCode",
        ort: "city",
        kanton: "district",
        verfuegbar: "accessSchedule",
        bemerkung: "specificLocation",
        // baession no existe en la fuente; campo map_links disponible pero es URL de mapa
        // normalizeRecord aplana geo_point_2d:{lon,lat} → claves planas
        "geo_point_2d.lat": "latitude",
        "geo_point_2d.lon": "longitude",
      },
      fieldTransformers: {
        verfuegbar: ["german-schedule"],
      },
    },
  },

  // ============================================================
  // 13. Bruselas (Bélgica) — OpenDataSoft API v2.1
  // 99 registros con coordenadas
  // ============================================================
  {
    name: "DAE Bruxelles - Ville de Bruxelles",
    description:
      "Défibrillateurs DEA installés par la Ville de Bruxelles — OpenData Brussels (OpenDataSoft). 99 DAE. Datos bilingües FR/NL.",
    type: "REST_API",
    sourceOrigin: "EXTERNAL_API",
    countryCode: "BE",
    regionCode: "BE-BRU",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "REST_API",
      apiEndpoint:
        "https://opendata.brussels.be/api/explore/v2.1/catalog/datasets/defibrillateurs-installes-par-la-ville-de-bruxelles/records",
      responseDataPath: "results",
      pagination: {
        strategy: "offset",
        limitParam: "limit",
        limitValue: 100,
        offsetParam: "offset",
        totalCountPath: "total_count",
      },
      fieldMappings: {
        registratienummer: "externalId",
        type: "deviceBrand",
        model: "deviceModel",
        naam_van_het_gebouw: "name",
        adresse: "streetName", // "Thys-Vanhamstraat 21" → transformer separa calle + número
        code_postal: "postalCode",
        commune: "city",
        etage: "floor",
        localisation_interne: "specificLocation",
        acces: "accessDescription",
        // normalizeRecord aplana coordonnees_geographiques:{lon,lat} → claves planas
        "coordonnees_geographiques.lat": "latitude",
        "coordonnees_geographiques.lon": "longitude",
      },
      fieldTransformers: {
        adresse: ["address-number-split"],
      },
    },
  },

  // ============================================================
  // 14. Uruguay — Registro de Instalación de DEA (MSP)
  // ~900 registros con coordenadas (CSV, separador ;)
  // ============================================================
  {
    name: "DEAs Uruguay - MSP",
    description:
      "Registro de Instalación de DEA — Ministerio de Salud Pública de Uruguay (CKAN/CSV). ~900 registros. Incluye marca, modelo y fechas de vencimiento de parches/baterías. Separador: punto y coma. Decimal: coma.",
    type: "CSV_FILE",
    sourceOrigin: "HEALTH_API",
    countryCode: "UY",
    regionCode: "UY",
    matchingStrategy: "HYBRID",
    matchingThreshold: 75,
    isActive: true,
    syncFrequency: "MONTHLY",
    autoDeactivateMissing: false,
    autoUpdateFields: [],
    defaultPublicationMode: "LOCATION_ONLY",
    config: {
      type: "CSV_FILE",
      fileUrl:
        "https://catalogodatos.gub.uy/dataset/7b3298be-45a0-413a-b397-9a0ae731d3ab/resource/36adf4bf-ffaa-42d5-8b05-932e6750eec0/download/registro-de-instalacion-dea-202504.csv",
      csvDelimiter: ";",
      fieldMappings: {
        id: "externalId",
        institucion: "name",
        departamento: "district",
        localidad: "city",
        calle: "streetName",
        numero: "streetNumber",
        esquinas: "additionalInfo",
        otros_datos: "specificLocation",
        ubicación_interna: "accessDescription",
        lat: "latitude",
        lon: "longitude",
        horario: "accessSchedule",
        dia: "scheduleDescription", // "Lun, Mar, Mie, Jue, Vie, Sab, Dom"
        equipo_marca: "deviceBrand",
        modelo: "deviceModel",
        n_reg_msp: "provisionalNumber",
        fecha_venc_parches: "deviceExpirationDate",
        fecha_venc_baterias: "internalNotes", // Fecha vencimiento baterías
        tipo_institucion: "establishmentType",
        fecha_inicio: "deviceInstallationDate",
        estado: "observations", // "Activo"/"Inactivo" — estado operativo
        // comentarios: suele ser "S/D" (sin datos), no aporta info útil
      },
      fieldTransformers: {
        horario: ["spanish-schedule"],
      },
    },
  },
];

// ============================================================
// API helpers
// ============================================================

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data.token as string;
  if (!token) throw new Error("No token in login response");
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

interface ExistingSource {
  id: string;
  name: string;
}

async function listDataSources(token: string): Promise<ExistingSource[]> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GET data-sources failed: ${res.status}`);
  const json = await res.json();
  return (json.data || []) as ExistingSource[];
}

async function createDataSource(token: string, def: DataSourceDef): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(def),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST data-source "${def.name}" failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.data.id as string;
}

async function updateDataSource(token: string, id: string, def: DataSourceDef): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/data-sources/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(def),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT data-source "${def.name}" failed (${res.status}): ${text}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n🔌 Connecting to ${BASE_URL}...\n`);

  // 1. Authenticate (use AUTH_TOKEN if provided, otherwise login)
  let token: string;
  if (AUTH_TOKEN) {
    console.log("🔐 Using provided AUTH_TOKEN...");
    token = AUTH_TOKEN;
    console.log("   ✅ Token set\n");
  } else {
    console.log(`🔐 Logging in as ${ADMIN_EMAIL}...`);
    token = await login();
    console.log("   ✅ Authenticated\n");
  }

  // 2. Get existing data sources
  const existing = await listDataSources(token);
  console.log(`📋 Existing data sources: ${existing.length}`);
  for (const ds of existing) {
    console.log(`   - ${ds.name} (${ds.id})`);
  }
  console.log();

  // 3. Upsert each definition
  for (const def of DATA_SOURCES) {
    const found = existing.find((e) => e.name === def.name);

    if (found) {
      console.log(`🔄 Updating "${def.name}" (${found.id})...`);
      await updateDataSource(token, found.id, def);
      console.log(`   ✅ Updated\n`);
    } else {
      console.log(`➕ Creating "${def.name}"...`);
      const id = await createDataSource(token, def);
      console.log(`   ✅ Created (${id})\n`);
    }
  }

  console.log("🎉 Done! All data sources are up to date.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
