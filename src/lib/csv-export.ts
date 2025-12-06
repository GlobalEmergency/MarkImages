/**
 * Utilidad para exportar datos de AED a formato CSV con UTF-8
 */

interface AedExportData {
  id?: string | null;
  status?: string | null;
  requires_attention?: boolean | null;
  attention_reason?: string | null;
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
  internal_notes?: string | null;
  origin_observations?: string | null;
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
    "db_id",
    "dea_status",
    "possible_duplicate",
    "duplicate_info",
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
    const notesContent = aed.internal_notes || aed.origin_observations || "";
    const parsedNotes = parseNotesContent(notesContent);

    return [
      aed.id ?? "", // db_id
      aed.status ?? "", // dea_status
      aed.requires_attention ? "SÍ" : "NO", // possible_duplicate
      aed.attention_reason ?? "", // duplicate_info
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
