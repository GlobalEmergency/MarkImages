/**
 * Value Object: Definición de un campo del sistema
 * Define qué campos se pueden mapear desde el CSV
 * Capa de Dominio
 */

export type FieldType = "string" | "number" | "boolean" | "url" | "email" | "date";

export interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  description?: string;
  examples?: string[];
  keywords?: string[]; // Palabras clave adicionales para mejorar matching
  validator?: (value: string) => boolean;
}

/**
 * Campos requeridos del sistema
 * Estos DEBEN ser mapeados para una importación válida
 */
export const REQUIRED_FIELDS: FieldDefinition[] = [
  {
    key: "proposedName",
    label: "Nombre propuesto",
    required: true,
    type: "string",
    description: "Nombre del establecimiento donde está el DEA",
    examples: ["Hospital General", "Centro Comercial Plaza", "Ayuntamiento"],
    keywords: [
      "proposedName", // Nombre técnico exacto
      "denominacion",
      "propuesta",
      "nombre",
      "establecimiento",
      "name",
      "propuesta de denominacion",
      "proposed name", // Inglés
      "establishment name", // Inglés
      "facility name", // Inglés
    ],
  },
  {
    key: "streetName",
    label: "Nombre de la vía",
    required: true,
    type: "string",
    description: "Nombre de la calle o vía",
    examples: ["Gran Vía", "Calle Mayor", "Paseo de la Castellana"],
    keywords: [
      "streetName", // Nombre técnico exacto
      "calle",
      "via",
      "nombre de la via",
      "street",
      "avenida",
      "paseo",
      "plaza",
      "street name", // Inglés
      "road name", // Inglés
      "avenue", // Inglés
    ],
  },
  {
    key: "streetNumber",
    label: "Número de la vía",
    required: true,
    type: "string",
    description: "Número del portal",
    examples: ["1", "25", "123 bis"],
    keywords: [
      "streetNumber", // Nombre técnico exacto
      "numero",
      "num",
      "portal",
      "numero de la via",
      "street number",
      "nº",
      "number", // Inglés
      "building number", // Inglés
    ],
  },
];

/**
 * Campos opcionales del sistema
 * Mejoran la información pero no son obligatorios
 */
export const OPTIONAL_FIELDS: FieldDefinition[] = [
  // === AED MAIN INFO ===
  {
    key: "code",
    label: "Código DEA",
    required: false,
    type: "string",
    description: "Código único asignado al DEA",
    keywords: ["code", "codigo", "identificador", "id", "aed code", "defibrillator code"],
  },
  {
    key: "provisionalNumber",
    label: "Número provisional DEA",
    required: false,
    type: "string",
    description: "Número provisional asignado",
    keywords: [
      "provisionalNumber",
      "provisional",
      "numero provisional",
      "num provisional",
      "temporal",
      "provisional number",
      "temporary number",
    ],
  },
  {
    key: "establishmentType",
    label: "Tipo de establecimiento",
    required: false,
    type: "string",
    description: "Tipo de establecimiento",
    examples: ["Hospital", "Centro deportivo", "Centro comercial"],
    keywords: [
      "establishmentType",
      "tipo",
      "establecimiento",
      "category",
      "categoria",
      "establishment type",
      "facility type",
      "type",
    ],
  },
  {
    key: "sourceOrigin",
    label: "Origen de datos",
    required: false,
    type: "string",
    description: "Origen del registro",
    keywords: [
      "sourceOrigin",
      "origen",
      "fuente",
      "source",
      "procedencia",
      "data source",
      "origin",
    ],
  },
  {
    key: "sourceDetails",
    label: "Detalles del origen",
    required: false,
    type: "string",
    description: "Información adicional del origen",
    keywords: [
      "sourceDetails",
      "detalles",
      "details",
      "info origen",
      "source details",
      "source info",
    ],
  },
  {
    key: "externalReference",
    label: "Referencia externa",
    required: false,
    type: "string",
    description: "ID o referencia en sistema externo",
    keywords: [
      "externalReference",
      "referencia",
      "reference",
      "id externo",
      "external id",
      "external reference",
      "ref",
    ],
  },

  // === LOCATION ===
  {
    key: "district",
    label: "Distrito",
    required: false,
    type: "string",
    description: "Distrito de Madrid donde se ubica el DEA",
    examples: ["Centro", "1. Centro", "Retiro", "3. Retiro"],
    keywords: ["district", "distrito", "zona", "demarcacion", "area", "region"],
  },
  {
    key: "streetType",
    label: "Tipo de vía",
    required: false,
    type: "string",
    description: "Tipo de vía (calle, avenida, plaza, etc.)",
    examples: ["Calle", "Avenida", "Plaza", "Paseo"],
    keywords: ["streetType", "tipo de via", "tipo via", "street type", "road type"],
  },
  {
    key: "additionalInfo",
    label: "Complemento de dirección",
    required: false,
    type: "string",
    description: "Información adicional de la dirección",
    examples: ["Edificio A", "Local 3", "Planta 2"],
    keywords: [
      "additionalInfo",
      "complemento",
      "adicional",
      "extra",
      "detalle direccion",
      "additional info",
      "address complement",
      "address details",
    ],
  },
  {
    key: "postalCode",
    label: "Código postal",
    required: false,
    type: "string",
    description: "Código postal de 5 dígitos",
    examples: ["28001", "28013", "28080"],
    keywords: ["postalCode", "cp", "postal", "codigo postal", "zip", "zip code", "postcode"],
  },
  {
    key: "latitude",
    label: "Latitud",
    required: false,
    type: "number",
    description: "Coordenada de latitud (formato decimal)",
    examples: ["40.4168", "40.416775"],
    keywords: [
      "latitude",
      "lat",
      "latitud",
      "coordenada",
      "coord y",
      "norte",
      "y",
      "coordenadas-latitud",
    ],
  },
  {
    key: "longitude",
    label: "Longitud",
    required: false,
    type: "number",
    description: "Coordenada de longitud (formato decimal, negativa para oeste)",
    examples: ["-3.7038", "-3.703790"],
    keywords: [
      "longitude",
      "lon",
      "lng",
      "longitud",
      "coordenada",
      "coord x",
      "oeste",
      "x",
      "coordenadas-longitud",
    ],
  },
  {
    key: "coordinatesPrecision",
    label: "Precisión de coordenadas",
    required: false,
    type: "string",
    description: "Nivel de precisión de las coordenadas",
    keywords: [
      "coordinatesPrecision",
      "precision",
      "accuracy",
      "exactitud coordenadas",
      "coordinates precision",
      "precision coordenadas",
    ],
  },
  {
    key: "cityName",
    label: "Ciudad",
    required: false,
    type: "string",
    description: "Nombre de la ciudad",
    examples: ["Madrid"],
    keywords: ["cityName", "ciudad", "city", "municipio", "localidad", "city name", "municipality"],
  },
  {
    key: "cityCode",
    label: "Código de ciudad",
    required: false,
    type: "string",
    description: "Código de la ciudad",
    keywords: ["cityCode", "codigo ciudad", "city code", "municipality code"],
  },
  {
    key: "districtCode",
    label: "Código de distrito",
    required: false,
    type: "string",
    description: "Código del distrito",
    keywords: ["districtCode", "codigo distrito", "district code", "cod distrito"],
  },
  {
    key: "districtName",
    label: "Nombre del distrito",
    required: false,
    type: "string",
    description: "Nombre completo del distrito",
    keywords: ["districtName", "nombre distrito", "district name"],
  },
  {
    key: "neighborhoodCode",
    label: "Código de barrio",
    required: false,
    type: "string",
    description: "Código del barrio",
    keywords: [
      "neighborhoodCode",
      "codigo barrio",
      "barrio",
      "neighborhood code",
      "cod barrio",
      "neighbourhood code",
    ],
  },
  {
    key: "neighborhoodName",
    label: "Nombre del barrio",
    required: false,
    type: "string",
    description: "Nombre del barrio",
    keywords: [
      "neighborhoodName",
      "nombre barrio",
      "barrio",
      "neighborhood",
      "neighbourhood",
      "neighborhood name",
    ],
  },
  {
    key: "accessDescription",
    label: "Descripción del acceso",
    required: false,
    type: "string",
    description: "Cómo acceder al DEA",
    keywords: [
      "accessDescription",
      "acceso",
      "access",
      "como llegar",
      "descripcion acceso",
      "access description",
      "how to access",
    ],
  },
  {
    key: "visibleReferences",
    label: "Referencias visibles",
    required: false,
    type: "string",
    description: "Elementos de referencia cercanos",
    keywords: [
      "visibleReferences",
      "referencias",
      "references",
      "puntos de referencia",
      "visible references",
      "landmarks",
    ],
  },
  {
    key: "floor",
    label: "Planta",
    required: false,
    type: "string",
    description: "Número de planta",
    examples: ["0", "1", "2", "Baja"],
    keywords: ["floor", "planta", "nivel", "piso", "level", "storey", "story"],
  },
  {
    key: "specificLocation",
    label: "Ubicación específica",
    required: false,
    type: "string",
    description: "Ubicación exacta dentro del edificio",
    keywords: [
      "specificLocation",
      "ubicacion",
      "location",
      "posicion",
      "lugar especifico",
      "specific location",
      "exact location",
      "position",
    ],
  },
  {
    key: "locationObservations",
    label: "Observaciones de ubicación",
    required: false,
    type: "string",
    description: "Observaciones adicionales sobre la ubicación",
    keywords: [
      "locationObservations",
      "observaciones ubicacion",
      "notas ubicacion",
      "location observations",
      "location notes",
    ],
  },
  {
    key: "accessWarnings",
    label: "Advertencias de acceso",
    required: false,
    type: "string",
    description: "Advertencias o restricciones de acceso",
    keywords: [
      "accessWarnings",
      "advertencias",
      "warnings",
      "restricciones acceso",
      "access warnings",
      "access restrictions",
    ],
  },

  // === RESPONSIBLE ===
  {
    key: "submitterEmail",
    label: "Correo electrónico",
    required: false,
    type: "email",
    description: "Email del responsable",
    examples: ["admin@hospital.com"],
    keywords: [
      "submitterEmail",
      "correo",
      "email",
      "mail",
      "e-mail",
      "correo electronico",
      "correo-e",
      "contact email",
    ],
  },
  {
    key: "submitterName",
    label: "Nombre del responsable",
    required: false,
    type: "string",
    description: "Nombre de la persona responsable",
    keywords: [
      "submitterName",
      "nombre",
      "responsable",
      "contacto",
      "titular",
      "name",
      "contact name",
      "responsible",
    ],
  },
  {
    key: "submitterPhone",
    label: "Teléfono del responsable",
    required: false,
    type: "string",
    description: "Teléfono de contacto",
    examples: ["+34 600 000 000", "912345678"],
    keywords: [
      "submitterPhone",
      "telefono",
      "tel",
      "phone",
      "movil",
      "celular",
      "contacto",
      "contact phone",
      "mobile",
    ],
  },
  {
    key: "alternativePhone",
    label: "Teléfono alternativo",
    required: false,
    type: "string",
    description: "Teléfono alternativo de contacto",
    keywords: [
      "alternativePhone",
      "telefono alternativo",
      "tel alternativo",
      "segundo telefono",
      "alternative phone",
      "secondary phone",
    ],
  },
  {
    key: "ownership",
    label: "Titularidad DEA",
    required: false,
    type: "string",
    description: "Titularidad del DEA",
    keywords: ["ownership", "titularidad", "propiedad", "titular", "owner"],
  },
  {
    key: "localOwnership",
    label: "Titularidad del local",
    required: false,
    type: "string",
    description: "Titularidad del establecimiento",
    keywords: [
      "localOwnership",
      "titularidad local",
      "propiedad local",
      "titular establecimiento",
      "local ownership",
      "facility ownership",
    ],
  },
  {
    key: "localUse",
    label: "Uso del local",
    required: false,
    type: "string",
    description: "Uso del establecimiento",
    keywords: [
      "localUse",
      "uso",
      "uso local",
      "actividad",
      "finalidad",
      "local use",
      "facility use",
      "purpose",
    ],
  },
  {
    key: "organization",
    label: "Organización",
    required: false,
    type: "string",
    description: "Organización responsable",
    keywords: [
      "organization",
      "organizacion",
      "empresa",
      "entidad",
      "institution",
      "company",
      "entity",
    ],
  },
  {
    key: "position",
    label: "Cargo",
    required: false,
    type: "string",
    description: "Cargo del responsable",
    keywords: ["position", "cargo", "puesto", "role", "title", "job title"],
  },
  {
    key: "department",
    label: "Departamento",
    required: false,
    type: "string",
    description: "Departamento del responsable",
    keywords: ["department", "departamento", "area", "seccion", "division", "section"],
  },
  {
    key: "contactObservations",
    label: "Observaciones de contacto",
    required: false,
    type: "string",
    description: "Notas sobre el contacto",
    keywords: [
      "contactObservations",
      "observaciones contacto",
      "notas contacto",
      "contact observations",
      "contact notes",
    ],
  },

  // === SCHEDULE ===
  {
    key: "scheduleDescription",
    label: "Descripción del horario",
    required: false,
    type: "string",
    description: "Descripción general del horario",
    keywords: [
      "scheduleDescription",
      "horario",
      "schedule",
      "descripcion horario",
      "horario apertura",
      "horario establecimiento",
      "schedule description",
      "opening hours",
    ],
  },
  {
    key: "weekdayOpening",
    label: "Hora apertura lunes-viernes",
    required: false,
    type: "string",
    description: "Hora de apertura entre semana (HH:MM)",
    examples: ["09:00", "08:30"],
    keywords: [
      "weekdayOpening",
      "apertura",
      "hora apertura",
      "lunes",
      "viernes",
      "entre semana",
      "opening",
      "hora de apertura de lunes a viernes",
      "weekday opening",
      "monday to friday opening",
    ],
  },
  {
    key: "weekdayClosing",
    label: "Hora cierre lunes-viernes",
    required: false,
    type: "string",
    description: "Hora de cierre entre semana (HH:MM)",
    examples: ["18:00", "20:00"],
    keywords: [
      "weekdayClosing",
      "cierre",
      "hora cierre",
      "lunes",
      "viernes",
      "entre semana",
      "closing",
      "hora de cierre de lunes a viernes",
      "weekday closing",
      "monday to friday closing",
    ],
  },
  {
    key: "saturdayOpening",
    label: "Hora apertura sábados",
    required: false,
    type: "string",
    description: "Hora de apertura los sábados (HH:MM)",
    keywords: [
      "saturdayOpening",
      "sabado",
      "sabados",
      "saturday",
      "apertura sabado",
      "hora de apertura los sabados",
      "saturday opening",
    ],
  },
  {
    key: "saturdayClosing",
    label: "Hora cierre sábados",
    required: false,
    type: "string",
    description: "Hora de cierre los sábados (HH:MM)",
    keywords: [
      "saturdayClosing",
      "sabado",
      "sabados",
      "saturday",
      "cierre sabado",
      "hora de cierre los sabados",
      "saturday closing",
    ],
  },
  {
    key: "sundayOpening",
    label: "Hora apertura domingos",
    required: false,
    type: "string",
    description: "Hora de apertura los domingos (HH:MM)",
    keywords: [
      "sundayOpening",
      "domingo",
      "domingos",
      "sunday",
      "apertura domingo",
      "hora de apertura los domingos",
      "sunday opening",
    ],
  },
  {
    key: "sundayClosing",
    label: "Hora cierre domingos",
    required: false,
    type: "string",
    description: "Hora de cierre los domingos (HH:MM)",
    keywords: [
      "sundayClosing",
      "domingo",
      "domingos",
      "sunday",
      "cierre domingo",
      "hora de cierre los domingos",
      "sunday closing",
    ],
  },
  {
    key: "has24hSurveillance",
    label: "¿Vigilancia 24h?",
    required: false,
    type: "boolean",
    description: "Si tiene vigilancia 24 horas",
    examples: ["Sí", "No", "Si", "true", "false"],
    keywords: [
      "has24hSurveillance",
      "vigilancia",
      "vigilante",
      "24h",
      "24 horas",
      "surveillance",
      "seguridad",
      "tiene vigilante 24 horas",
      "24h surveillance",
      "security",
    ],
  },
  {
    key: "hasRestrictedAccess",
    label: "¿Acceso restringido?",
    required: false,
    type: "boolean",
    description: "Si el acceso está restringido",
    keywords: [
      "hasRestrictedAccess",
      "acceso restringido",
      "restricted",
      "limitado",
      "restricted access",
      "limited access",
    ],
  },
  {
    key: "holidaysAsWeekday",
    label: "¿Festivos como entre semana?",
    required: false,
    type: "boolean",
    description: "Si en festivos tiene el horario de entre semana",
    keywords: [
      "holidaysAsWeekday",
      "festivos",
      "holidays",
      "dias festivos",
      "holidays as weekday",
      "public holidays",
    ],
  },
  {
    key: "closedOnHolidays",
    label: "¿Cerrado en festivos?",
    required: false,
    type: "boolean",
    description: "Si cierra en días festivos",
    keywords: [
      "closedOnHolidays",
      "cerrado festivos",
      "closed holidays",
      "closed on public holidays",
    ],
  },
  {
    key: "closedInAugust",
    label: "¿Cerrado en agosto?",
    required: false,
    type: "boolean",
    description: "Si cierra en agosto",
    keywords: [
      "closedInAugust",
      "agosto",
      "august",
      "cerrado agosto",
      "vacaciones",
      "closed in august",
      "vacation",
    ],
  },
  {
    key: "scheduleExceptions",
    label: "Excepciones del horario",
    required: false,
    type: "string",
    description: "Excepciones o cambios en el horario",
    keywords: [
      "scheduleExceptions",
      "excepciones",
      "exceptions",
      "cambios horario",
      "schedule exceptions",
      "special hours",
    ],
  },
  {
    key: "accessInstructions",
    label: "Instrucciones de acceso",
    required: false,
    type: "string",
    description: "Instrucciones para acceder al DEA",
    keywords: [
      "accessInstructions",
      "instrucciones",
      "instructions",
      "como acceder",
      "access instructions",
      "how to reach",
    ],
  },

  // === IMAGES ===
  {
    key: "photo1Url",
    label: "Foto 1 (URL)",
    required: false,
    type: "url",
    description: "URL de la primera foto",
    keywords: [
      "photo1Url",
      "foto",
      "photo",
      "imagen",
      "image",
      "foto 1",
      "picture",
      "photo 1",
      "photo1",
      "image 1",
    ],
  },
  {
    key: "photo2Url",
    label: "Foto 2 (URL)",
    required: false,
    type: "url",
    description: "URL de la segunda foto",
    keywords: [
      "photo2Url",
      "foto",
      "photo",
      "imagen",
      "image",
      "foto 2",
      "picture",
      "photo 2",
      "photo2",
      "image 2",
    ],
  },
  {
    key: "photoFrontUrl",
    label: "Foto frontal (URL)",
    required: false,
    type: "url",
    description: "URL de la foto frontal del DEA",
    keywords: [
      "photoFrontUrl",
      "foto frontal",
      "front",
      "frontal",
      "photo front",
      "front photo",
      "front image",
    ],
  },
  {
    key: "photoLocationUrl",
    label: "Foto ubicación (URL)",
    required: false,
    type: "url",
    description: "URL de la foto de ubicación",
    keywords: [
      "photoLocationUrl",
      "foto ubicacion",
      "location",
      "contexto",
      "location photo",
      "location image",
      "context photo",
    ],
  },
  {
    key: "photoAccessUrl",
    label: "Foto acceso (URL)",
    required: false,
    type: "url",
    description: "URL de la foto del acceso",
    keywords: [
      "photoAccessUrl",
      "foto acceso",
      "access",
      "access photo",
      "access image",
      "entrance photo",
    ],
  },

  // === OBSERVATIONS AND NOTES ===
  {
    key: "originObservations",
    label: "Observaciones de origen",
    required: false,
    type: "string",
    description: "Observaciones del registro original",
    keywords: [
      "originObservations",
      "observaciones origen",
      "notas origen",
      "origin observations",
      "origin notes",
      "source observations",
    ],
  },
  {
    key: "validationObservations",
    label: "Observaciones de validación",
    required: false,
    type: "string",
    description: "Observaciones del proceso de validación",
    keywords: [
      "validationObservations",
      "observaciones validacion",
      "notas validacion",
      "validation observations",
      "validation notes",
    ],
  },
  {
    key: "internalNotes",
    label: "Notas internas",
    required: false,
    type: "string",
    description: "Notas internas del sistema",
    keywords: [
      "internalNotes",
      "notas",
      "notes",
      "comentarios",
      "observaciones internas",
      "internal notes",
      "comments",
      "internal comments",
    ],
  },
  {
    key: "freeComment",
    label: "Comentario libre",
    required: false,
    type: "string",
    description: "Comentario o nota adicional",
    keywords: [
      "freeComment",
      "comentario",
      "comment",
      "nota libre",
      "observaciones",
      "comentario libre",
      "free comment",
      "additional comment",
      "remarks",
    ],
  },

  // === STATUS AND METADATA ===
  {
    key: "status",
    label: "Estado",
    required: false,
    type: "string",
    description: "Estado del DEA (DRAFT, PUBLISHED, etc.)",
    keywords: ["status", "estado", "situacion", "state", "condition"],
  },
  {
    key: "requiresAttention",
    label: "¿Requiere atención?",
    required: false,
    type: "boolean",
    description: "Si el registro requiere revisión",
    keywords: [
      "requiresAttention",
      "atencion",
      "attention",
      "requiere revision",
      "requires attention",
      "needs review",
    ],
  },
  {
    key: "attentionReason",
    label: "Motivo de atención",
    required: false,
    type: "string",
    description: "Motivo por el que requiere atención",
    keywords: [
      "attentionReason",
      "motivo atencion",
      "razon atencion",
      "attention reason",
      "reason for attention",
    ],
  },
  {
    key: "rejectionReason",
    label: "Motivo de rechazo",
    required: false,
    type: "string",
    description: "Motivo de rechazo del registro",
    keywords: [
      "rejectionReason",
      "rechazo",
      "rejection",
      "motivo rechazo",
      "rejection reason",
      "reason for rejection",
    ],
  },

  // === DATES ===
  {
    key: "publishedAt",
    label: "Fecha de publicación",
    required: false,
    type: "date",
    description: "Fecha en que se publicó el registro",
    keywords: [
      "publishedAt",
      "fecha publicacion",
      "published",
      "publicado",
      "publication date",
      "published date",
    ],
  },
  {
    key: "createdAt",
    label: "Fecha de creación",
    required: false,
    type: "date",
    description: "Fecha de creación del registro",
    keywords: ["createdAt", "fecha creacion", "created", "creado", "creation date", "created date"],
  },
  {
    key: "updatedAt",
    label: "Fecha de actualización",
    required: false,
    type: "date",
    description: "Fecha de última actualización",
    keywords: [
      "updatedAt",
      "fecha actualizacion",
      "updated",
      "modificado",
      "update date",
      "modified date",
      "last modified",
    ],
  },

  // === TIMESTAMPS (from CSV) ===
  {
    key: "startTime",
    label: "Hora de inicio",
    required: false,
    type: "string",
    description: "Hora de inicio del registro",
    keywords: ["startTime", "hora inicio", "start time", "inicio", "start", "begin time"],
  },
  {
    key: "endTime",
    label: "Hora de finalización",
    required: false,
    type: "string",
    description: "Hora de finalización del registro",
    keywords: [
      "endTime",
      "hora finalizacion",
      "end time",
      "fin",
      "hora final",
      "end",
      "finish time",
    ],
  },
];

/**
 * Obtiene todos los campos (requeridos + opcionales)
 */
export function getAllFields(): FieldDefinition[] {
  return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
}

/**
 * Busca un campo por su key
 */
export function getFieldByKey(key: string): FieldDefinition | undefined {
  return getAllFields().find((field) => field.key === key);
}

/**
 * Valida si un campo es requerido
 */
export function isRequiredField(key: string): boolean {
  return REQUIRED_FIELDS.some((field) => field.key === key);
}

/**
 * Busca campos por palabra clave
 */
export function findFieldsByKeyword(keyword: string): FieldDefinition[] {
  const normalizedKeyword = keyword
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return getAllFields().filter((field) => {
    const fieldKeywords = field.keywords || [];
    return fieldKeywords.some((kw) => {
      const normalizedKw = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normalizedKw.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedKw);
    });
  });
}
