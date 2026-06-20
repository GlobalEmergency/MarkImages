/**
 * Utilidad para exportar datos de AED a formato CSV con UTF-8
 */

export interface AedExportData {
  provisional_number?: number | null;
  code?: string | null;
  establishment_type?: string | null;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: {
    street_type?: string | null;
    street_name?: string | null;
    street_number?: string | null;
    postal_code?: string | null;
    city_name?: string | null;
    city_code?: string | null;
    district_name?: string | null;
    neighborhood_name?: string | null;
  } | null;
  schedule?: {
    has_24h_surveillance: boolean;
    weekday_opening?: string | null;
    weekday_closing?: string | null;
    saturday_opening?: string | null;
    saturday_closing?: string | null;
    sunday_opening?: string | null;
    sunday_closing?: string | null;
  } | null;
  responsible?: {
    name?: string | null;
    ownership?: string | null;
    local_ownership?: string | null;
    local_use?: string | null;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_notes?: any | null;
}

/**
 * Interfaz completa para exportación en formato de importación
 * Incluye TODOS los campos del CSV de importación simplificado
 */
export interface AedImportFormatData {
  id?: string | null;
  sequence?: number | null;
  provisional_number?: number | null;
  code?: string | null;
  external_reference?: string | null;
  name: string;
  establishment_type?: string | null;

  // Responsable
  responsible?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    alternative_phone?: string | null;
    organization?: string | null;
    position?: string | null;
    department?: string | null;
    observations?: string | null;
    notes?: string | null;
    ownership?: string | null;
    local_ownership?: string | null;
    local_use?: string | null;
  } | null;

  // Ubicación
  location?: {
    street_type?: string | null;
    street_name?: string | null;
    street_number?: string | null;
    additional_info?: string | null;
    postal_code?: string | null;
    city_name?: string | null;
    city_code?: string | null;
    district_name?: string | null;
    neighborhood_name?: string | null;
    floor?: string | null;
    specific_location?: string | null;

    // Campos consolidados nuevos
    access_instructions?: string | null;
    public_notes?: string | null;

    // Campos deprecados (fallback)
    access_description?: string | null;
    visible_references?: string | null;
    access_warnings?: string | null;
    location_observations?: string | null;
  } | null;

  // Coordenadas
  latitude?: number | null;
  longitude?: number | null;
  coordinates_precision?: string | null;

  // Horarios
  schedule?: {
    description?: string | null;
    weekday_opening?: string | null;
    weekday_closing?: string | null;
    saturday_opening?: string | null;
    saturday_closing?: string | null;
    sunday_opening?: string | null;
    sunday_closing?: string | null;
    has_24h_surveillance?: boolean | null;
    has_restricted_access?: boolean | null;
    holidays_as_weekday?: boolean | null;
    closed_on_holidays?: boolean | null;
    closed_in_august?: boolean | null;
    schedule_exceptions?: string | null;
  } | null;

  // Imágenes
  images?: Array<{
    url?: string | null;
    sequence?: number | null;
  }>;

  // Estado y notas
  status?: string | null;
  requires_attention?: boolean | null;
  attention_reason?: string | null;
  published_at?: Date | null;

  // Notas (consolidadas)
  public_notes?: string | null;
  internal_notes?: string | null;
  validation_notes?: string | null;

  // Notas deprecadas (fallback)
  origin_observations?: string | null;
  validation_observations?: string | null;
}

/**
 * Parsea el contenido de notas para extraer información estructurada
 */
function parseNotesContent(notes: string): {
  legacyId: string;
  reviewedBy: string;
  reviewerEmail: string;
  reviewPeriod: string;
  imageVerification: string;
  addressValidation: string;
  otherNotes: string;
} {
  const result = {
    legacyId: "",
    reviewedBy: "",
    reviewerEmail: "",
    reviewPeriod: "",
    imageVerification: "",
    addressValidation: "",
    otherNotes: "",
  };

  if (!notes) return result;

  // Extraer Legacy ID
  const legacyIdMatch = notes.match(/Legacy ID:\s*(\d+)/);
  if (legacyIdMatch) result.legacyId = legacyIdMatch[1];

  // Extraer Reviewed by
  const reviewedByMatch = notes.match(/Reviewed by:\s*([^\n]+)/);
  if (reviewedByMatch) result.reviewedBy = reviewedByMatch[1].trim();

  // Extraer Email
  const emailMatch = notes.match(/Email:\s*([^\n]+)/);
  if (emailMatch) result.reviewerEmail = emailMatch[1].trim();

  // Extraer Review period
  const reviewPeriodMatch = notes.match(/Review period:\s*([^\n]+)/);
  if (reviewPeriodMatch) result.reviewPeriod = reviewPeriodMatch[1].trim();

  // Extraer Image verification
  const imageVerificationMatch = notes.match(/Image verification:\s*([^\n]+)/);
  if (imageVerificationMatch) result.imageVerification = imageVerificationMatch[1].trim();

  // Extraer Address validation
  const addressValidationMatch = notes.match(/Address validation:\s*([^\n]+)/);
  if (addressValidationMatch) result.addressValidation = addressValidationMatch[1].trim();

  // Extraer notas adicionales (todo lo que no sea datos estructurados)
  const otherNotes = notes
    .replace(/=== LEGACY MIGRATION DATA ===/g, "")
    .replace(/--- Review Information ---/g, "")
    .replace(/--- Validation Status ---/g, "")
    .replace(/Provisional Number:\s*\d+/g, "")
    .replace(/Legacy ID:\s*\d+/g, "")
    .replace(/Reviewed by:\s*[^\n]+/g, "")
    .replace(/Email:\s*[^\n]+/g, "")
    .replace(/Review period:\s*[^\n]+/g, "")
    .replace(/Image verification:\s*[^\n]+/g, "")
    .replace(/Address validation:\s*[^\n]+/g, "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  result.otherNotes = otherNotes;

  return result;
}

/**
 * Convierte un array de AEDs a formato CSV con las columnas requeridas
 * Usa punto y coma (;) como separador para compatibilidad con Excel
 */
export function aedsToCsv(aeds: AedExportData[]): string {
  // Definir las columnas del CSV según los requisitos + columnas adicionales para información estructurada
  const headers = [
    "provisional_id",
    "RM_ID",
    "type",
    "property",
    "function",
    "owner",
    "name",
    "type of road",
    "name of road",
    "number of road",
    "zip code",
    "city",
    "district",
    "neighborhood",
    "latitude",
    "longitude",
    "¿opening 24/7?",
    "opening Mon-Fri",
    "closing Mon-Fri",
    "opening Sat",
    "closing Sat",
    "opening Sun",
    "closing Sun",
    "security guard 24/7",
    "INCLUDE",
    "notes",
    "COO",
    // Columnas adicionales para información estructurada
    "legacy_id",
    "reviewed_by",
    "reviewer_email",
    "review_period",
    "image_verification",
    "address_validation",
  ];

  // Crear filas de datos
  const rows = aeds.map((aed) => {
    // Handle JSON internal_notes or string fallback
    let notesContent = "";
    if (aed.internal_notes) {
      if (Array.isArray(aed.internal_notes)) {
        notesContent = aed.internal_notes.map((n: { text?: string }) => n.text || "").join("\n");
      } else if (typeof aed.internal_notes === "string") {
        notesContent = aed.internal_notes;
      }
    }
    const parsedNotes = parseNotesContent(notesContent);

    return [
      aed.provisional_number ?? "", // provisional_id
      aed.code ?? "", // RM_ID
      aed.establishment_type ?? "", // type
      aed.responsible?.local_ownership ?? "", // property
      aed.responsible?.local_use ?? "", // function
      aed.responsible?.name ?? "", // owner
      aed.name ?? "", // name
      aed.location?.street_type ?? "", // type of road
      aed.location?.street_name ?? "", // name of road
      aed.location?.street_number ?? "", // number of road
      aed.location?.postal_code ?? "", // zip code
      aed.location?.city_name ?? "", // city
      aed.location?.district_name ?? "", // district
      aed.location?.neighborhood_name ?? "", // neighborhood
      aed.latitude ?? "", // latitude
      aed.longitude ?? "", // longitude
      aed.schedule?.has_24h_surveillance ? "SÍ" : "NO", // ¿opening 24/7?
      aed.schedule?.weekday_opening ?? "", // opening Mon-Fri
      aed.schedule?.weekday_closing ?? "", // closing Mon-Fri
      aed.schedule?.saturday_opening ?? "", // opening Sat
      aed.schedule?.saturday_closing ?? "", // closing Sat
      aed.schedule?.sunday_opening ?? "", // opening Sun
      aed.schedule?.sunday_closing ?? "", // closing Sun
      "", // security guard 24/7 (no data available)
      "", // INCLUDE (no data available)
      parsedNotes.otherNotes, // notes (solo notas adicionales)
      "", // COO (no data available)
      // Columnas adicionales
      parsedNotes.legacyId, // legacy_id
      parsedNotes.reviewedBy, // reviewed_by
      parsedNotes.reviewerEmail, // reviewer_email
      parsedNotes.reviewPeriod, // review_period
      parsedNotes.imageVerification, // image_verification
      parsedNotes.addressValidation, // address_validation
    ];
  });

  // Función para escapar valores CSV (RFC 4180 compliant, usando ; como separador)
  const escapeCsvValue = (value: string | number): string => {
    const stringValue = String(value);

    // Limpiar caracteres problemáticos: tabs, retornos de carro, y normalizar saltos de línea
    const cleanValue = stringValue
      .replace(/\t/g, " ") // Reemplazar tabs con espacios
      .replace(/\r\n/g, " ") // Reemplazar CRLF con espacio
      .replace(/\r/g, " ") // Reemplazar CR con espacio
      .replace(/\n/g, " "); // Reemplazar LF con espacio

    // Si contiene punto y coma o comillas, envolver en comillas y duplicar comillas internas
    if (cleanValue.includes(";") || cleanValue.includes('"')) {
      return `"${cleanValue.replace(/"/g, '""')}"`;
    }
    return cleanValue;
  };

  // Generar CSV con separador punto y coma (;)
  const csvLines = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => row.map(escapeCsvValue).join(";")),
  ];

  return csvLines.join("\n");
}

/**
 * Genera un nombre de archivo para la exportación
 */
export function generateExportFilename(filters?: {
  status?: string[];
  sourceOrigin?: string;
  importBatchId?: string;
}): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const parts = ["deas", timestamp];

  if (filters?.status && filters.status.length > 0) {
    parts.push(filters.status.join("-").toLowerCase());
  }

  if (filters?.sourceOrigin) {
    parts.push(filters.sourceOrigin.toLowerCase());
  }

  if (filters?.importBatchId) {
    parts.push("batch");
  }

  return `${parts.join("_")}.csv`;
}

/**
 * Crea un Blob con el contenido CSV en UTF-8
 */
export function createCsvBlob(csvContent: string): Blob {
  // Agregar BOM (Byte Order Mark) para UTF-8 para mejor compatibilidad con Excel
  const BOM = "\uFEFF";
  return new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
}

/**
 * Convierte un array de AEDs a formato CSV compatible con IMPORTACIÓN
 * Usa el mismo formato de 58 columnas que la plantilla de importación
 * Usa punto y coma (;) como separador para compatibilidad con Excel
 */
export function aedsToImportFormatCsv(aeds: AedImportFormatData[]): string {
  // Definir las 58 columnas según la plantilla de importación simplificada
  const headers = [
    "Id",
    "Número provisional DEA",
    "Código DEA",
    "Referencia externa",
    "Propuesta de denominación",
    "Tipo de establecimiento",
    "Titularidad",
    "Titularidad del local",
    "Uso del local",
    "Observaciones origen",
    "Tipo de vía",
    "Nombre de la vía",
    "Número de la vía",
    "Complemento de dirección",
    "Código postal",
    "Ciudad",
    "Código ciudad",
    "Distrito",
    "Barrio",
    "Planta",
    "Ubicación específica",
    "Instrucciones de acceso",
    "Comentarios públicos",
    "Coordenadas-Latitud (norte)",
    "Coordenadas-Longitud (oeste, por lo tanto, negativa)",
    "Precisión coordenadas",
    "Horario de apertura del establecimiento",
    "Hora de APERTURA de lunes a viernes",
    "Hora de CIERRE de lunes a viernes",
    "Hora de APERTURA los sábados",
    "Hora de CIERRE los sábados",
    "Hora de APERTURA los domingos",
    "Hora de CIERRE los domingos",
    "¿Tiene vigilante 24 horas al día que pueda facilitar el desfibrilador en caso necesario aunque esté cerrado?",
    "Acceso restringido",
    "Festivos como día laborable",
    "Cerrado en festivos",
    "Cerrado en agosto",
    "Excepciones horario",
    "Nombre",
    "Correo electrónico",
    "Teléfono",
    "Teléfono alternativo",
    "Organización",
    "Cargo",
    "Departamento",
    "Observaciones contacto",
    "Notas responsable",
    "Foto 1",
    "Foto 2",
    "Foto 3",
    "Foto 4",
    "Foto 5",
    "Foto 6",
    "Estado",
    "Requiere atención",
    "Motivo atención",
    "Notas de validación",
    "Notas internas",
    "Fecha publicación",
  ];

  // Crear filas de datos
  const rows = aeds.map((aed) => {
    // Consolidar instrucciones de acceso (nuevo formato o fallback a campos deprecados)
    const accessInstructions =
      aed.location?.access_instructions ||
      [
        aed.location?.access_description,
        aed.location?.visible_references,
        aed.location?.access_warnings,
      ]
        .filter(Boolean)
        .join(". ");

    // Consolidar comentarios públicos (nuevo formato o fallback)
    const publicNotes =
      aed.location?.public_notes || aed.public_notes || aed.location?.location_observations || "";

    // Consolidar notas de validación
    const validationNotes = aed.validation_notes || aed.validation_observations || "";

    // Consolidar notas internas
    const internalNotes = aed.internal_notes || aed.origin_observations || "";

    // Obtener URLs de imágenes (hasta 6)
    const imageUrls = (aed.images || [])
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .slice(0, 6)
      .map((img) => img.url || "");
    while (imageUrls.length < 6) imageUrls.push(""); // Rellenar hasta 6

    return [
      aed.id ?? "", // Id (UUID único)
      aed.provisional_number ?? "", // Número provisional DEA
      aed.code ?? "", // Código DEA
      aed.external_reference ?? "", // Referencia externa
      aed.name ?? "", // Propuesta de denominación
      aed.establishment_type ?? "", // Tipo de establecimiento
      aed.responsible?.ownership ?? "", // Titularidad
      aed.responsible?.local_ownership ?? "", // Titularidad del local
      aed.responsible?.local_use ?? "", // Uso del local
      aed.origin_observations ?? "", // Observaciones origen (deprecated pero se mantiene)
      aed.location?.street_type ?? "", // Tipo de vía
      aed.location?.street_name ?? "", // Nombre de la vía
      aed.location?.street_number ?? "", // Número de la vía
      aed.location?.additional_info ?? "", // Complemento de dirección
      aed.location?.postal_code ?? "", // Código postal
      aed.location?.city_name ?? "", // Ciudad
      aed.location?.city_code ?? "", // Código ciudad
      aed.location?.district_name ?? "", // Distrito
      aed.location?.neighborhood_name ?? "", // Barrio
      aed.location?.floor ?? "", // Planta
      aed.location?.specific_location ?? "", // Ubicación específica
      accessInstructions, // Instrucciones de acceso (consolidado)
      publicNotes, // Comentarios públicos (consolidado)
      aed.latitude ?? "", // Coordenadas-Latitud
      aed.longitude ?? "", // Coordenadas-Longitud
      aed.coordinates_precision ?? "", // Precisión coordenadas
      aed.schedule?.description ?? "", // Horario de apertura del establecimiento
      aed.schedule?.weekday_opening ?? "", // Hora de APERTURA de lunes a viernes
      aed.schedule?.weekday_closing ?? "", // Hora de CIERRE de lunes a viernes
      aed.schedule?.saturday_opening ?? "", // Hora de APERTURA los sábados
      aed.schedule?.saturday_closing ?? "", // Hora de CIERRE los sábados
      aed.schedule?.sunday_opening ?? "", // Hora de APERTURA los domingos
      aed.schedule?.sunday_closing ?? "", // Hora de CIERRE los domingos
      aed.schedule?.has_24h_surveillance ? "Sí" : "No", // ¿Tiene vigilante 24h?
      aed.schedule?.has_restricted_access ? "Sí" : "No", // Acceso restringido
      aed.schedule?.holidays_as_weekday ? "Sí" : "No", // Festivos como día laborable
      aed.schedule?.closed_on_holidays ? "Sí" : "No", // Cerrado en festivos
      aed.schedule?.closed_in_august ? "Sí" : "No", // Cerrado en agosto
      aed.schedule?.schedule_exceptions ?? "", // Excepciones horario
      aed.responsible?.name ?? "", // Nombre
      aed.responsible?.email ?? "", // Correo electrónico
      aed.responsible?.phone ?? "", // Teléfono
      aed.responsible?.alternative_phone ?? "", // Teléfono alternativo
      aed.responsible?.organization ?? "", // Organización
      aed.responsible?.position ?? "", // Cargo
      aed.responsible?.department ?? "", // Departamento
      aed.responsible?.observations ?? "", // Observaciones contacto
      aed.responsible?.notes ?? "", // Notas responsable
      imageUrls[0], // Foto 1
      imageUrls[1], // Foto 2
      imageUrls[2], // Foto 3
      imageUrls[3], // Foto 4
      imageUrls[4], // Foto 5
      imageUrls[5], // Foto 6
      aed.status ?? "", // Estado
      aed.requires_attention ? "Sí" : "No", // Requiere atención
      aed.attention_reason ?? "", // Motivo atención
      validationNotes, // Notas de validación (consolidado)
      internalNotes, // Notas internas (consolidado)
      aed.published_at ? new Date(aed.published_at).toISOString().split(".")[0] : "", // Fecha publicación
    ];
  });

  // Función para escapar valores CSV (RFC 4180 compliant, usando ; como separador)
  const escapeCsvValue = (value: string | number): string => {
    const stringValue = String(value);

    // Limpiar caracteres problemáticos: tabs, retornos de carro, y normalizar saltos de línea
    const cleanValue = stringValue
      .replace(/\t/g, " ") // Reemplazar tabs con espacios
      .replace(/\r\n/g, " ") // Reemplazar CRLF con espacio
      .replace(/\r/g, " ") // Reemplazar CR con espacio
      .replace(/\n/g, " "); // Reemplazar LF con espacio

    // Si contiene punto y coma o comillas, envolver en comillas y duplicar comillas internas
    if (cleanValue.includes(";") || cleanValue.includes('"')) {
      return `"${cleanValue.replace(/"/g, '""')}"`;
    }
    return cleanValue;
  };

  // Generar CSV con separador punto y coma (;)
  const csvLines = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => row.map(escapeCsvValue).join(";")),
  ];

  return csvLines.join("\n");
}
