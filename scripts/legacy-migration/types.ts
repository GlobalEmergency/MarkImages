/**
 * Types for Legacy DEA Migration
 * Domain Layer - Value Objects
 */

// ============================================
// LEGACY DATABASE TYPES
// ============================================

export interface LegacyDeaRecord {
  id: number;
  horaInicio: string;
  horaFinalizacion: string;
  correoElectronico: string;
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  titularidadLocal: string;
  usoLocal: string;
  titularidad: string;
  propuestaDenominacion: string;

  // Campos originales (NO usar)
  tipoVia: string | null;
  nombreVia: string | null;
  numeroVia: string | null;
  complementoDireccion: string | null;
  codigoPostal: number;
  distrito: string;
  latitud: number;
  longitud: number;

  // Campos definitivos (USAR ESTOS)
  defTipoVia: string | null;
  defNombreVia: string | null;
  defNumero: string | null;
  defCp: string | null;
  defDistrito: string | null;
  defLat: number | null;
  defLon: number | null;
  defCodDea: string | null;
  defBarrio: string | null;

  // Campos GM (NO usar)
  gmTipoVia: string | null;
  gmNombreVia: string | null;
  gmNumero: string | null;
  gmCp: string | null;
  gmDistrito: string | null;
  gmLat: number | null;
  gmLon: number | null;
  gmBarrio: string | null;

  // Horarios
  horarioApertura: string;
  aperturaLunesViernes: number;
  cierreLunesViernes: number;
  aperturaSabados: number;
  cierreSabados: number;
  aperturaDomingos: number;
  cierreDomingos: number;
  vigilante24h: string;

  // Imágenes
  foto1: string | null;
  foto2: string | null;

  // Observaciones
  descripcionAcceso: string | null;
  comentarioLibre: string | null;

  // Estados
  image_verification_status: string;
  address_validation_status: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface LegacyVerificationSession {
  id: string;
  dea_record_id: number;
  status: string;
  original_image_url: string | null;
  cropped_image_url: string | null;
  processed_image_url: string | null;
  second_image_url: string | null;
  second_cropped_image_url: string | null;
  second_processed_image_url: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  image1_valid: boolean | null;
  image2_valid: boolean | null;
  images_swapped: boolean | null;
  marked_as_invalid: boolean;
}

// ============================================
// TRANSFORMED DATA TYPES
// ============================================

export interface TransformedAed {
  aed: AedData;
  location: LocationData;
  schedule: ScheduleData;
  responsible: ResponsibleData;
  images: ImageData[];
  validations: ValidationData[];
  addressValidation: AddressValidationData;
}

export interface AedData {
  code: string | null;
  name: string;
  establishment_type: string | null;
  provisional_number: number | null;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "INACTIVE";
  source_origin: "LEGACY_MIGRATION";
  external_reference: string;
  latitude: number | null;
  longitude: number | null;
  internal_notes: string;
  origin_observations: string;
  requires_attention?: boolean;
  attention_reason?: string;
}

export interface LocationData {
  street_type: string;
  street_name: string;
  street_number: string | null;
  postal_code: string;
  latitude: number;
  longitude: number;
  district_name: string | null;
  district_code: string | null;
  neighborhood_name: string | null;
  neighborhood_code: string | null;
  city_name: string | null;
  city_code: string | null;
  access_description: string | null;
}

export interface ScheduleData {
  description: string | null;
  has_24h_surveillance: boolean;
  weekday_opening: string | null;
  weekday_closing: string | null;
  saturday_opening: string | null;
  saturday_closing: string | null;
  sunday_opening: string | null;
  sunday_closing: string | null;
}

export interface ResponsibleData {
  name: string;
  organization: string | null;
  ownership: string | null;
  local_use: string | null;
  observations: string | null;
}

export interface ImageData {
  type: "FRONT" | "LOCATION";
  order: number;
  original_url: string;
  processed_url: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number;
  format: string;
  is_verified: boolean;
  verified_at: Date | null;
}

export interface ValidationData {
  type: "ADDRESS" | "IMAGES";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  verified_by: string | null;
  completed_at: Date | null;
}

export interface AddressValidationData {
  address_found: boolean;
  match_level: number;
  match_type: string;
  suggested_latitude: number | null;
  suggested_longitude: number | null;
  official_district_id: number | null;
  official_neighborhood_id: number | null;
}

// ============================================
// MIGRATION TYPES
// ============================================

export interface MigrationConfig {
  legacyDatabaseUrl: string;
  currentDatabaseUrl: string;
  s3Bucket: string;
  s3Region: string;
  batchSize: number;
  dryRun: boolean;
  skipImages: boolean;
}

export interface MigrationResult {
  totalRecords: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  errors: MigrationError[];
  duration: number;
}

export interface MigrationError {
  legacyId: number;
  error: string;
  record: any;
}

export interface MigrationProgress {
  current: number;
  total: number;
  percentage: number;
  successCount: number;
  errorCount: number;
}
