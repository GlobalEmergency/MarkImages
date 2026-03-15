/**
 * Value Object: Registro de importación unificado
 * Capa de Dominio - Unifica CsvRow, DynamicCsvRow y registros de API
 *
 * Este VO representa un registro a importar independientemente de su origen
 * (CSV, API CKAN, JSON, etc.)
 */

import { createHash } from "crypto";
import type { DataSourceType } from "../ports/IDataSourceAdapter";
import type { ColumnMapping } from "./ColumnMapping";

/**
 * Datos normalizados de un registro
 */
export interface NormalizedRecordData {
  // Identificación
  id?: string | null;
  proposedName?: string | null;
  name?: string | null;
  establishmentType?: string | null;
  provisionalNumber?: string | null;

  // Dirección
  streetType?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  additionalInfo?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  specificLocation?: string | null;

  // Geografía
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
  neighborhood?: string | null;
  neighborhoodCode?: string | null;
  latitude?: string | null;
  longitude?: string | null;

  // Acceso
  accessDescription?: string | null;
  accessSchedule?: string | null;
  accessRestriction?: string | null; // "true"/"false" — acceso restringido (maps to has_restricted_access)
  isPmrAccessible?: string | null; // "true"/"false" — accesible PMR / movilidad reducida
  ownershipType?: string | null;

  // Horarios
  scheduleDescription?: string | null;
  has24hSurveillance?: string | null;
  weekdayOpening?: string | null;
  weekdayClosing?: string | null;
  saturdayOpening?: string | null;
  saturdayClosing?: string | null;
  sundayOpening?: string | null;
  sundayClosing?: string | null;

  // Responsable
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterPhone?: string | null;
  ownership?: string | null;
  localOwnership?: string | null;
  localUse?: string | null;

  // Imágenes
  photo1Url?: string | null;
  photo2Url?: string | null;

  // Observaciones
  observations?: string | null;

  // Dispositivo (desfibrilador físico)
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceSerialNumber?: string | null;
  deviceManufacturingDate?: string | null;
  deviceInstallationDate?: string | null;
  deviceExpirationDate?: string | null;
  deviceLastMaintenanceDate?: string | null;
  isMobileUnit?: string | null; // "true"/"false" — el DEA se mueve (ambulancia, vehículo, etc.)

  // Campos adicionales dinámicos
  [key: string]: string | null | undefined;
}

/**
 * Value Object: Registro de importación unificado
 */
export class ImportRecord {
  // Prefijos para IDs externos auto-generados
  private static readonly AUTO_GENERATED_PREFIXES = ["row-", "api-", "json-"];

  private constructor(
    public readonly sourceType: DataSourceType,
    public readonly externalId: string | null,
    public readonly rawData: Record<string, unknown>,
    private readonly normalizedData: NormalizedRecordData,
    public readonly contentHash: string,
    public readonly rowIndex: number
  ) {}

  // ============================================
  // FACTORY METHODS
  // ============================================

  /**
   * Crea un ImportRecord desde una fila CSV con mappings
   */
  static fromCsvRow(
    row: Record<string, string>,
    mappings: ColumnMapping[],
    rowIndex: number
  ): ImportRecord {
    const normalized = this.applyColumnMappings(row, mappings);
    const hash = this.computeHash(row);
    const externalId = normalized.id || `row-${rowIndex + 2}`; // +2 por header y 0-based

    return new ImportRecord("CSV_FILE", externalId, row, normalized, hash, rowIndex);
  }

  /**
   * Crea un ImportRecord desde un registro de API (ej: CKAN)
   */
  static fromApiRecord(
    record: Record<string, unknown>,
    fieldMappings: Record<string, string>,
    rowIndex: number,
    externalIdField: string = "codigo_dea"
  ): ImportRecord {
    const normalized = this.applyFieldMappings(record, fieldMappings);
    const hash = this.computeHash(record);
    const externalId = record[externalIdField]
      ? String(record[externalIdField])
      : `api-${rowIndex}`;

    return new ImportRecord("CKAN_API", externalId, record, normalized, hash, rowIndex);
  }

  /**
   * Crea un ImportRecord desde un objeto JSON
   */
  static fromJsonRecord(
    record: Record<string, unknown>,
    fieldMappings: Record<string, string>,
    rowIndex: number,
    externalIdField?: string
  ): ImportRecord {
    const normalized = this.applyFieldMappings(record, fieldMappings);
    const hash = this.computeHash(record);
    const externalId =
      externalIdField && record[externalIdField]
        ? String(record[externalIdField])
        : `json-${rowIndex}`;

    return new ImportRecord("JSON_FILE", externalId, record, normalized, hash, rowIndex);
  }

  /**
   * Crea un ImportRecord desde datos ya normalizados
   */
  static fromNormalized(
    sourceType: DataSourceType,
    normalized: NormalizedRecordData,
    rowIndex: number,
    externalId?: string
  ): ImportRecord {
    const hash = this.computeHash(normalized);
    const id = externalId || normalized.id || `record-${rowIndex}`;

    return new ImportRecord(sourceType, id, normalized, normalized, hash, rowIndex);
  }

  /**
   * Crea un ImportRecord desde un registro de caché S3 que ya contiene datos normalizados
   * El formato esperado es: { externalId, name, ..., _rawData, _contentHash, _rowIndex }
   */
  static fromCachedRecord(
    cachedRecord: Record<string, unknown>,
    sourceType: DataSourceType = "CKAN_API"
  ): ImportRecord {
    // Extract metadata fields
    const rawData = (cachedRecord._rawData as Record<string, unknown>) || cachedRecord;
    const contentHash = (cachedRecord._contentHash as string) || this.computeHash(cachedRecord);
    const rowIndex = (cachedRecord._rowIndex as number) || 0;
    const externalId = cachedRecord.externalId as string | null;

    // Build normalized data from the cached record (excluding metadata fields)
    const normalized: NormalizedRecordData = {};
    for (const [key, value] of Object.entries(cachedRecord)) {
      // Skip metadata fields
      if (key.startsWith("_")) continue;
      // Include string, null, and number values (convert numbers to strings)
      if (value === null) {
        normalized[key] = null;
      } else if (typeof value === "string") {
        normalized[key] = value;
      } else if (typeof value === "number") {
        // Convert numbers to strings (for latitude, longitude, etc.)
        normalized[key] = value.toString();
      }
    }

    return new ImportRecord(sourceType, externalId, rawData, normalized, contentHash, rowIndex);
  }

  // ============================================
  // GETTERS NORMALIZADOS
  // ============================================

  // Identificación
  get name(): string | null {
    // Primero intentar con campos mapeados
    const mappedName = this.normalizedData.proposedName ?? this.normalizedData.name;
    if (mappedName) return mappedName;

    // Generación automática basada en externalId o dirección
    // Si hay código externo válido (no generado automáticamente), usarlo
    if (this.externalId && !this.isAutoGeneratedExternalId()) {
      return this.externalId;
    }

    // Generar nombre desde dirección
    return this.generateNameFromAddress();
  }

  /**
   * Verifica si el externalId fue generado automáticamente
   */
  private isAutoGeneratedExternalId(): boolean {
    if (!this.externalId) return false;
    return ImportRecord.AUTO_GENERATED_PREFIXES.some((prefix) =>
      this.externalId!.startsWith(prefix)
    );
  }

  /**
   * Genera un nombre automático desde la dirección
   * Formato: "Calle xxxxx, numero, ciudad"
   */
  private generateNameFromAddress(): string | null {
    const parts: string[] = [];

    // Tipo de vía + nombre de vía
    if (this.streetType && this.streetName) {
      parts.push(`${this.streetType} ${this.streetName}`);
    } else if (this.streetName) {
      parts.push(this.streetName);
    }

    // Número
    if (this.streetNumber) {
      parts.push(this.streetNumber);
    }

    // Ciudad
    if (this.city) {
      parts.push(this.city);
    }

    // Si no tenemos suficiente información, devolver null
    if (parts.length === 0) {
      return null;
    }

    return parts.join(", ");
  }

  get establishmentType(): string | null {
    return this.normalizedData.establishmentType ?? null;
  }

  get provisionalNumber(): string | null {
    return this.normalizedData.provisionalNumber ?? null;
  }

  // Dirección
  get streetType(): string | null {
    return this.normalizedData.streetType ?? null;
  }

  get streetName(): string | null {
    return this.normalizedData.streetName ?? null;
  }

  get streetNumber(): string | null {
    return this.normalizedData.streetNumber ?? null;
  }

  get additionalInfo(): string | null {
    return this.normalizedData.additionalInfo ?? null;
  }

  get postalCode(): string | null {
    return this.normalizedData.postalCode ?? null;
  }

  get floor(): string | null {
    return this.normalizedData.floor ?? null;
  }

  get specificLocation(): string | null {
    return this.normalizedData.specificLocation ?? null;
  }

  // Geografía
  get city(): string | null {
    return this.normalizedData.city ?? null;
  }

  get cityCode(): string | null {
    return this.normalizedData.cityCode ?? null;
  }

  get district(): string | null {
    return this.normalizedData.district ?? null;
  }

  get districtCode(): string | null {
    return this.normalizedData.districtCode ?? null;
  }

  get neighborhood(): string | null {
    return this.normalizedData.neighborhood ?? null;
  }

  get latitude(): number | null {
    const val = this.normalizedData.latitude;
    if (!val) return null;
    // Soportar formato español (coma) y estándar (punto)
    const parsed = parseFloat(val.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  }

  get longitude(): number | null {
    const val = this.normalizedData.longitude;
    if (!val) return null;
    const parsed = parseFloat(val.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  }

  // Acceso
  get accessDescription(): string | null {
    return this.normalizedData.accessDescription ?? null;
  }

  get accessSchedule(): string | null {
    return this.normalizedData.accessSchedule ?? null;
  }

  get accessRestriction(): boolean {
    const value = this.normalizedData.accessRestriction?.toLowerCase().trim();
    // France c_acc_lib: "t" = libre (no restriction), "f" = restricted
    if (value === "f" || value === "false" || value === "0" || value === "no") return true;
    if (value === "restringido" || value === "restreint" || value === "restricted") return true;
    return false;
  }

  get isPmrAccessible(): boolean | null {
    const value = this.normalizedData.isPmrAccessible?.toLowerCase().trim();
    if (!value) return null;
    if (
      value === "sí" ||
      value === "si" ||
      value === "yes" ||
      value === "true" ||
      value === "t" ||
      value === "1" ||
      value === "oui"
    )
      return true;
    if (value === "no" || value === "false" || value === "f" || value === "0" || value === "non")
      return false;
    return null;
  }

  get ownershipType(): string | null {
    return this.normalizedData.ownershipType ?? null;
  }

  // Horarios
  get scheduleDescription(): string | null {
    return this.normalizedData.scheduleDescription ?? null;
  }

  get has24hSurveillance(): boolean {
    const value = this.normalizedData.has24hSurveillance?.toLowerCase().trim();
    return value === "sí" || value === "si" || value === "yes" || value === "true" || value === "1";
  }

  get weekdayOpening(): string | null {
    return this.normalizedData.weekdayOpening ?? null;
  }

  get weekdayClosing(): string | null {
    return this.normalizedData.weekdayClosing ?? null;
  }

  get saturdayOpening(): string | null {
    return this.normalizedData.saturdayOpening ?? null;
  }

  get saturdayClosing(): string | null {
    return this.normalizedData.saturdayClosing ?? null;
  }

  get sundayOpening(): string | null {
    return this.normalizedData.sundayOpening ?? null;
  }

  get sundayClosing(): string | null {
    return this.normalizedData.sundayClosing ?? null;
  }

  // Responsable
  get submitterName(): string | null {
    return this.normalizedData.submitterName ?? null;
  }

  get submitterEmail(): string | null {
    return this.normalizedData.submitterEmail ?? null;
  }

  get submitterPhone(): string | null {
    return this.normalizedData.submitterPhone ?? null;
  }

  get ownership(): string | null {
    return this.normalizedData.ownership ?? null;
  }

  get localOwnership(): string | null {
    return this.normalizedData.localOwnership ?? null;
  }

  get localUse(): string | null {
    return this.normalizedData.localUse ?? null;
  }

  // Imágenes
  get photo1Url(): string | null {
    return this.normalizedData.photo1Url ?? null;
  }

  get photo2Url(): string | null {
    return this.normalizedData.photo2Url ?? null;
  }

  // Observaciones
  get observations(): string | null {
    return this.normalizedData.observations ?? null;
  }

  // Dispositivo
  get deviceBrand(): string | null {
    return this.normalizedData.deviceBrand ?? null;
  }

  get deviceModel(): string | null {
    return this.normalizedData.deviceModel ?? null;
  }

  get deviceSerialNumber(): string | null {
    return this.normalizedData.deviceSerialNumber ?? null;
  }

  get deviceManufacturingDate(): string | null {
    return this.normalizedData.deviceManufacturingDate ?? null;
  }

  get deviceInstallationDate(): string | null {
    return this.normalizedData.deviceInstallationDate ?? null;
  }

  get deviceExpirationDate(): string | null {
    return this.normalizedData.deviceExpirationDate ?? null;
  }

  get deviceLastMaintenanceDate(): string | null {
    return this.normalizedData.deviceLastMaintenanceDate ?? null;
  }

  get isMobileUnit(): boolean {
    const value = this.normalizedData.isMobileUnit?.toLowerCase().trim();
    return value === "true" || value === "t" || value === "1" || value === "oui";
  }

  // Detalles de ubicación (combinación de additionalInfo y specificLocation)
  get locationDetails(): string | null {
    const parts: string[] = [];
    if (this.additionalInfo) parts.push(this.additionalInfo);
    if (this.specificLocation) parts.push(this.specificLocation);
    return parts.length > 0 ? parts.join(". ").trim() : null;
  }

  // Instrucciones de acceso (alias de accessDescription para consistencia)
  get accessInstructions(): string | null {
    return this.accessDescription;
  }

  // ============================================
  // MÉTODOS DE UTILIDAD
  // ============================================

  /**
   * Obtiene un campo por clave
   */
  get(field: string): string | null {
    const value = this.normalizedData[field];
    return value !== undefined && value !== null && value !== "" ? value : null;
  }

  /**
   * Verifica si un campo existe y tiene valor
   */
  has(field: string): boolean {
    const value = this.normalizedData[field];
    return value !== undefined && value !== null && value !== "";
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  /**
   * Verifica si tiene los campos mínimos requeridos
   */
  hasMinimumRequiredFields(): boolean {
    return !!(this.name && this.streetName && this.streetNumber);
  }

  /**
   * Verifica si tiene coordenadas válidas
   */
  hasCoordinates(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  /**
   * Verifica si tiene una referencia externa real (no generada)
   */
  hasExternalReference(): boolean {
    return (
      this.externalId !== null &&
      !this.externalId.startsWith("row-") &&
      !this.externalId.startsWith("api-") &&
      !this.externalId.startsWith("json-") &&
      !this.externalId.startsWith("record-")
    );
  }

  /**
   * Lista los campos que faltan de los requeridos
   */
  getMissingRequiredFields(): string[] {
    const missing: string[] = [];
    if (!this.name) missing.push("name");
    if (!this.streetName) missing.push("streetName");
    if (!this.streetNumber) missing.push("streetNumber");
    return missing;
  }

  /**
   * Lista los campos que tienen valor
   */
  getPopulatedFields(): string[] {
    return Object.entries(this.normalizedData)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key]) => key);
  }

  // ============================================
  // COMPARACIÓN
  // ============================================

  /**
   * Compara con otro registro por hash
   */
  equals(other: ImportRecord): boolean {
    return this.contentHash === other.contentHash;
  }

  /**
   * Detecta qué campos han cambiado respecto a otro registro
   */
  getChangedFields(other: ImportRecord): string[] {
    const changed: string[] = [];
    const allKeys = new Set([
      ...Object.keys(this.normalizedData),
      ...Object.keys(other.normalizedData),
    ]);

    for (const key of allKeys) {
      const thisVal = this.normalizedData[key];
      const otherVal = other.normalizedData[key];
      if (thisVal !== otherVal) {
        changed.push(key);
      }
    }

    return changed;
  }

  // ============================================
  // SERIALIZACIÓN
  // ============================================

  /**
   * Convierte a objeto plano para serialización
   */
  toJSON(): Record<string, unknown> {
    return {
      sourceType: this.sourceType,
      externalId: this.externalId,
      rowIndex: this.rowIndex,
      contentHash: this.contentHash,
      data: this.normalizedData,
      raw: this.rawData,
    };
  }

  /**
   * Obtiene solo los datos normalizados
   */
  getNormalizedData(): NormalizedRecordData {
    return { ...this.normalizedData };
  }

  /**
   * Crea desde objeto plano
   */
  static fromJSON(json: ReturnType<ImportRecord["toJSON"]>): ImportRecord {
    return new ImportRecord(
      json.sourceType as DataSourceType,
      json.externalId as string | null,
      json.raw as Record<string, unknown>,
      json.data as NormalizedRecordData,
      json.contentHash as string,
      json.rowIndex as number
    );
  }

  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  /**
   * Aplica mappings de columnas CSV
   */
  private static applyColumnMappings(
    row: Record<string, string>,
    mappings: ColumnMapping[]
  ): NormalizedRecordData {
    const result: NormalizedRecordData = {};

    for (const mapping of mappings) {
      const csvColumn = mapping.csvColumnName;
      const systemField = mapping.systemFieldKey;
      const value = row[csvColumn];

      if (value !== undefined && value !== null && value.trim() !== "") {
        result[systemField] = value.trim();
      }
    }

    return result;
  }

  /**
   * Aplica mappings de campos de API
   */
  private static applyFieldMappings(
    record: Record<string, unknown>,
    mappings: Record<string, string>
  ): NormalizedRecordData {
    const result: NormalizedRecordData = {};

    // Campos que deben tratarse como números (pueden venir con formato español: coma como separador decimal)
    const numericFields = ["latitude", "longitude", "utmX", "utmY"];

    for (const [apiField, systemField] of Object.entries(mappings)) {
      const value = record[apiField];
      if (value !== undefined && value !== null) {
        let processedValue = String(value).trim();

        // Filtrar valores nulos disfrazados de string (ej: OpenDataSoft devuelve "null")
        if (
          processedValue === "null" ||
          processedValue === "NULL" ||
          processedValue === "undefined"
        ) {
          continue;
        }

        // Convertir formato español (coma) a formato estándar (punto) para campos numéricos
        if (numericFields.includes(systemField) && processedValue) {
          processedValue = processedValue.replace(",", ".");
        }

        result[systemField] = processedValue || null;
      }
    }

    return result;
  }

  /**
   * Calcula hash del contenido para detección de cambios
   */
  private static computeHash(data: Record<string, unknown>): string {
    // Ordenar claves para hash consistente
    const sortedKeys = Object.keys(data).sort();
    const normalized = sortedKeys.map((key) => `${key}:${data[key] ?? ""}`).join("|");

    return createHash("sha256").update(normalized).digest("hex").substring(0, 32);
  }
}
