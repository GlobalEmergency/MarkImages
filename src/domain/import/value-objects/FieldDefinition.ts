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
      "denominacion",
      "propuesta",
      "nombre",
      "establecimiento",
      "name",
      "propuesta de denominacion",
    ],
  },
  {
    key: "streetName",
    label: "Nombre de la vía",
    required: true,
    type: "string",
    description: "Nombre de la calle o vía",
    examples: ["Gran Vía", "Calle Mayor", "Paseo de la Castellana"],
    keywords: ["calle", "via", "nombre de la via", "street", "avenida", "paseo", "plaza"],
  },
  {
    key: "streetNumber",
    label: "Número de la vía",
    required: true,
    type: "string",
    description: "Número del portal",
    examples: ["1", "25", "123 bis"],
    keywords: ["numero", "num", "portal", "numero de la via", "street number", "nº"],
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
    keywords: ["codigo", "code", "identificador", "id"],
  },
  {
    key: "provisionalNumber",
    label: "Número provisional DEA",
    required: false,
    type: "string",
    description: "Número provisional asignado",
    keywords: ["provisional", "numero provisional", "num provisional", "temporal"],
  },
  {
    key: "establishmentType",
    label: "Tipo de establecimiento",
    required: false,
    type: "string",
    description: "Tipo de establecimiento",
    examples: ["Hospital", "Centro deportivo", "Centro comercial"],
    keywords: ["tipo", "establecimiento", "category", "categoria"],
  },
  {
    key: "sourceOrigin",
    label: "Origen de datos",
    required: false,
    type: "string",
    description: "Origen del registro",
    keywords: ["origen", "fuente", "source", "procedencia"],
  },
  {
    key: "sourceDetails",
    label: "Detalles del origen",
    required: false,
    type: "string",
    description: "Información adicional del origen",
    keywords: ["detalles", "details", "info origen"],
  },
  {
    key: "externalReference",
    label: "Referencia externa",
    required: false,
    type: "string",
    description: "ID o referencia en sistema externo",
    keywords: ["referencia", "reference", "id externo", "external id"],
  },

  // === LOCATION ===
  {
    key: "district",
    label: "Distrito",
    required: false,
    type: "string",
    description: "Distrito de Madrid donde se ubica el DEA",
    examples: ["Centro", "1. Centro", "Retiro", "3. Retiro"],
    keywords: ["distrito", "district", "zona", "demarcacion"],
  },
  {
    key: "streetType",
    label: "Tipo de vía",
    required: false,
    type: "string",
    description: "Tipo de vía (calle, avenida, plaza, etc.)",
    examples: ["Calle", "Avenida", "Plaza", "Paseo"],
    keywords: ["tipo de via", "tipo via", "street type"],
  },
  {
    key: "additionalInfo",
    label: "Complemento de dirección",
    required: false,
    type: "string",
    description: "Información adicional de la dirección",
    examples: ["Edificio A", "Local 3", "Planta 2"],
    keywords: ["complemento", "adicional", "extra", "detalle direccion"],
  },
  {
    key: "postalCode",
    label: "Código postal",
    required: false,
    type: "string",
    description: "Código postal de 5 dígitos",
    examples: ["28001", "28013", "28080"],
    keywords: ["cp", "postal", "codigo postal", "zip", "zip code"],
  },
  {
    key: "latitude",
    label: "Latitud",
    required: false,
    type: "number",
    description: "Coordenada de latitud (formato decimal)",
    examples: ["40.4168", "40.416775"],
    keywords: ["lat", "latitud", "coordenada", "coord y", "norte", "latitude", "y"],
  },
  {
    key: "longitude",
    label: "Longitud",
    required: false,
    type: "number",
    description: "Coordenada de longitud (formato decimal, negativa para oeste)",
    examples: ["-3.7038", "-3.703790"],
    keywords: ["lon", "lng", "longitud", "coordenada", "coord x", "oeste", "longitude", "x"],
  },
  {
    key: "coordinatesPrecision",
    label: "Precisión de coordenadas",
    required: false,
    type: "string",
    description: "Nivel de precisión de las coordenadas",
    keywords: ["precision", "accuracy", "exactitud coordenadas"],
  },
  {
    key: "cityName",
    label: "Ciudad",
    required: false,
    type: "string",
    description: "Nombre de la ciudad",
    examples: ["Madrid"],
    keywords: ["ciudad", "city", "municipio", "localidad"],
  },
  {
    key: "cityCode",
    label: "Código de ciudad",
    required: false,
    type: "string",
    description: "Código de la ciudad",
    keywords: ["codigo ciudad", "city code"],
  },
  {
    key: "districtCode",
    label: "Código de distrito",
    required: false,
    type: "string",
    description: "Código del distrito",
    keywords: ["codigo distrito", "district code", "cod distrito"],
  },
  {
    key: "districtName",
    label: "Nombre del distrito",
    required: false,
    type: "string",
    description: "Nombre completo del distrito",
    keywords: ["nombre distrito", "district name"],
  },
  {
    key: "neighborhoodCode",
    label: "Código de barrio",
    required: false,
    type: "string",
    description: "Código del barrio",
    keywords: ["codigo barrio", "barrio", "neighborhood code", "cod barrio"],
  },
  {
    key: "neighborhoodName",
    label: "Nombre del barrio",
    required: false,
    type: "string",
    description: "Nombre del barrio",
    keywords: ["nombre barrio", "barrio", "neighborhood"],
  },
  {
    key: "accessDescription",
    label: "Descripción del acceso",
    required: false,
    type: "string",
    description: "Cómo acceder al DEA",
    keywords: ["acceso", "access", "como llegar", "descripcion acceso"],
  },
  {
    key: "visibleReferences",
    label: "Referencias visibles",
    required: false,
    type: "string",
    description: "Elementos de referencia cercanos",
    keywords: ["referencias", "references", "puntos de referencia"],
  },
  {
    key: "floor",
    label: "Planta",
    required: false,
    type: "string",
    description: "Número de planta",
    examples: ["0", "1", "2", "Baja"],
    keywords: ["planta", "floor", "nivel", "piso"],
  },
  {
    key: "specificLocation",
    label: "Ubicación específica",
    required: false,
    type: "string",
    description: "Ubicación exacta dentro del edificio",
    keywords: ["ubicacion", "location", "posicion", "lugar especifico"],
  },
  {
    key: "locationObservations",
    label: "Observaciones de ubicación",
    required: false,
    type: "string",
    description: "Observaciones adicionales sobre la ubicación",
    keywords: ["observaciones ubicacion", "notas ubicacion"],
  },
  {
    key: "accessWarnings",
    label: "Advertencias de acceso",
    required: false,
    type: "string",
    description: "Advertencias o restricciones de acceso",
    keywords: ["advertencias", "warnings", "restricciones acceso"],
  },

  // === RESPONSIBLE ===
  {
    key: "submitterEmail",
    label: "Correo electrónico",
    required: false,
    type: "email",
    description: "Email del responsable",
    examples: ["admin@hospital.com"],
    keywords: ["correo", "email", "mail", "e-mail", "correo electronico", "correo-e"],
  },
  {
    key: "submitterName",
    label: "Nombre del responsable",
    required: false,
    type: "string",
    description: "Nombre de la persona responsable",
    keywords: ["nombre", "responsable", "contacto", "titular", "name"],
  },
  {
    key: "submitterPhone",
    label: "Teléfono del responsable",
    required: false,
    type: "string",
    description: "Teléfono de contacto",
    examples: ["+34 600 000 000", "912345678"],
    keywords: ["telefono", "tel", "phone", "movil", "celular", "contacto"],
  },
  {
    key: "alternativePhone",
    label: "Teléfono alternativo",
    required: false,
    type: "string",
    description: "Teléfono alternativo de contacto",
    keywords: ["telefono alternativo", "tel alternativo", "segundo telefono"],
  },
  {
    key: "ownership",
    label: "Titularidad DEA",
    required: false,
    type: "string",
    description: "Titularidad del DEA",
    keywords: ["titularidad", "ownership", "propiedad", "titular"],
  },
  {
    key: "localOwnership",
    label: "Titularidad del local",
    required: false,
    type: "string",
    description: "Titularidad del establecimiento",
    keywords: ["titularidad local", "propiedad local", "titular establecimiento"],
  },
  {
    key: "localUse",
    label: "Uso del local",
    required: false,
    type: "string",
    description: "Uso del establecimiento",
    keywords: ["uso", "uso local", "actividad", "finalidad"],
  },
  {
    key: "organization",
    label: "Organización",
    required: false,
    type: "string",
    description: "Organización responsable",
    keywords: ["organizacion", "empresa", "entidad", "institution"],
  },
  {
    key: "position",
    label: "Cargo",
    required: false,
    type: "string",
    description: "Cargo del responsable",
    keywords: ["cargo", "puesto", "position", "role"],
  },
  {
    key: "department",
    label: "Departamento",
    required: false,
    type: "string",
    description: "Departamento del responsable",
    keywords: ["departamento", "department", "area", "seccion"],
  },
  {
    key: "contactObservations",
    label: "Observaciones de contacto",
    required: false,
    type: "string",
    description: "Notas sobre el contacto",
    keywords: ["observaciones contacto", "notas contacto"],
  },

  // === SCHEDULE ===
  {
    key: "scheduleDescription",
    label: "Descripción del horario",
    required: false,
    type: "string",
    description: "Descripción general del horario",
    keywords: [
      "horario",
      "schedule",
      "descripcion horario",
      "horario apertura",
      "horario establecimiento",
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
      "apertura",
      "hora apertura",
      "lunes",
      "viernes",
      "entre semana",
      "opening",
      "hora de apertura de lunes a viernes",
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
      "cierre",
      "hora cierre",
      "lunes",
      "viernes",
      "entre semana",
      "closing",
      "hora de cierre de lunes a viernes",
    ],
  },
  {
    key: "saturdayOpening",
    label: "Hora apertura sábados",
    required: false,
    type: "string",
    description: "Hora de apertura los sábados (HH:MM)",
    keywords: ["sabado", "sabados", "saturday", "apertura sabado", "hora de apertura los sabados"],
  },
  {
    key: "saturdayClosing",
    label: "Hora cierre sábados",
    required: false,
    type: "string",
    description: "Hora de cierre los sábados (HH:MM)",
    keywords: ["sabado", "sabados", "saturday", "cierre sabado", "hora de cierre los sabados"],
  },
  {
    key: "sundayOpening",
    label: "Hora apertura domingos",
    required: false,
    type: "string",
    description: "Hora de apertura los domingos (HH:MM)",
    keywords: [
      "domingo",
      "domingos",
      "sunday",
      "apertura domingo",
      "hora de apertura los domingos",
    ],
  },
  {
    key: "sundayClosing",
    label: "Hora cierre domingos",
    required: false,
    type: "string",
    description: "Hora de cierre los domingos (HH:MM)",
    keywords: ["domingo", "domingos", "sunday", "cierre domingo", "hora de cierre los domingos"],
  },
  {
    key: "has24hSurveillance",
    label: "¿Vigilancia 24h?",
    required: false,
    type: "boolean",
    description: "Si tiene vigilancia 24 horas",
    examples: ["Sí", "No", "Si", "true", "false"],
    keywords: [
      "vigilancia",
      "vigilante",
      "24h",
      "24 horas",
      "surveillance",
      "seguridad",
      "tiene vigilante 24 horas",
    ],
  },
  {
    key: "hasRestrictedAccess",
    label: "¿Acceso restringido?",
    required: false,
    type: "boolean",
    description: "Si el acceso está restringido",
    keywords: ["acceso restringido", "restricted", "limitado"],
  },
  {
    key: "holidaysAsWeekday",
    label: "¿Festivos como entre semana?",
    required: false,
    type: "boolean",
    description: "Si en festivos tiene el horario de entre semana",
    keywords: ["festivos", "holidays", "dias festivos"],
  },
  {
    key: "closedOnHolidays",
    label: "¿Cerrado en festivos?",
    required: false,
    type: "boolean",
    description: "Si cierra en días festivos",
    keywords: ["cerrado festivos", "closed holidays"],
  },
  {
    key: "closedInAugust",
    label: "¿Cerrado en agosto?",
    required: false,
    type: "boolean",
    description: "Si cierra en agosto",
    keywords: ["agosto", "august", "cerrado agosto", "vacaciones"],
  },
  {
    key: "scheduleExceptions",
    label: "Excepciones del horario",
    required: false,
    type: "string",
    description: "Excepciones o cambios en el horario",
    keywords: ["excepciones", "exceptions", "cambios horario"],
  },
  {
    key: "accessInstructions",
    label: "Instrucciones de acceso",
    required: false,
    type: "string",
    description: "Instrucciones para acceder al DEA",
    keywords: ["instrucciones", "instructions", "como acceder"],
  },

  // === IMAGES ===
  {
    key: "photo1Url",
    label: "Foto 1 (URL)",
    required: false,
    type: "url",
    description: "URL de la primera foto",
    keywords: ["foto", "photo", "imagen", "image", "foto 1", "picture"],
  },
  {
    key: "photo2Url",
    label: "Foto 2 (URL)",
    required: false,
    type: "url",
    description: "URL de la segunda foto",
    keywords: ["foto", "photo", "imagen", "image", "foto 2", "picture"],
  },
  {
    key: "photoFrontUrl",
    label: "Foto frontal (URL)",
    required: false,
    type: "url",
    description: "URL de la foto frontal del DEA",
    keywords: ["foto frontal", "front", "frontal"],
  },
  {
    key: "photoLocationUrl",
    label: "Foto ubicación (URL)",
    required: false,
    type: "url",
    description: "URL de la foto de ubicación",
    keywords: ["foto ubicacion", "location", "contexto"],
  },
  {
    key: "photoAccessUrl",
    label: "Foto acceso (URL)",
    required: false,
    type: "url",
    description: "URL de la foto del acceso",
    keywords: ["foto acceso", "access"],
  },

  // === OBSERVATIONS AND NOTES ===
  {
    key: "originObservations",
    label: "Observaciones de origen",
    required: false,
    type: "string",
    description: "Observaciones del registro original",
    keywords: ["observaciones origen", "notas origen"],
  },
  {
    key: "validationObservations",
    label: "Observaciones de validación",
    required: false,
    type: "string",
    description: "Observaciones del proceso de validación",
    keywords: ["observaciones validacion", "notas validacion"],
  },
  {
    key: "internalNotes",
    label: "Notas internas",
    required: false,
    type: "string",
    description: "Notas internas del sistema",
    keywords: ["notas", "notes", "comentarios", "observaciones internas"],
  },
  {
    key: "freeComment",
    label: "Comentario libre",
    required: false,
    type: "string",
    description: "Comentario o nota adicional",
    keywords: ["comentario", "comment", "nota libre", "observaciones", "comentario libre"],
  },

  // === STATUS AND METADATA ===
  {
    key: "status",
    label: "Estado",
    required: false,
    type: "string",
    description: "Estado del DEA (DRAFT, PUBLISHED, etc.)",
    keywords: ["estado", "status", "situacion"],
  },
  {
    key: "requiresAttention",
    label: "¿Requiere atención?",
    required: false,
    type: "boolean",
    description: "Si el registro requiere revisión",
    keywords: ["atencion", "attention", "requiere revision"],
  },
  {
    key: "attentionReason",
    label: "Motivo de atención",
    required: false,
    type: "string",
    description: "Motivo por el que requiere atención",
    keywords: ["motivo atencion", "razon atencion"],
  },
  {
    key: "rejectionReason",
    label: "Motivo de rechazo",
    required: false,
    type: "string",
    description: "Motivo de rechazo del registro",
    keywords: ["rechazo", "rejection", "motivo rechazo"],
  },

  // === DATES ===
  {
    key: "publishedAt",
    label: "Fecha de publicación",
    required: false,
    type: "date",
    description: "Fecha en que se publicó el registro",
    keywords: ["fecha publicacion", "published", "publicado"],
  },
  {
    key: "createdAt",
    label: "Fecha de creación",
    required: false,
    type: "date",
    description: "Fecha de creación del registro",
    keywords: ["fecha creacion", "created", "creado"],
  },
  {
    key: "updatedAt",
    label: "Fecha de actualización",
    required: false,
    type: "date",
    description: "Fecha de última actualización",
    keywords: ["fecha actualizacion", "updated", "modificado"],
  },

  // === TIMESTAMPS (from CSV) ===
  {
    key: "startTime",
    label: "Hora de inicio",
    required: false,
    type: "string",
    description: "Hora de inicio del registro",
    keywords: ["hora inicio", "start time", "inicio"],
  },
  {
    key: "endTime",
    label: "Hora de finalización",
    required: false,
    type: "string",
    description: "Hora de finalización del registro",
    keywords: ["hora finalizacion", "end time", "fin", "hora final"],
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
