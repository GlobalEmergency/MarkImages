/**
 * Value Object: Representa una fila del CSV con mapeo dinámico
 * Capa de Dominio - Universal para cualquier ciudad europea
 */

export class DynamicCsvRow {
  constructor(private readonly data: Record<string, string>) {}

  /**
   * Obtiene el valor de un campo mapeado
   */
  get(field: string): string | null {
    const value = this.data[field];
    return value !== undefined && value !== null && value !== '' ? value : null;
  }

  /**
   * Verifica si un campo existe y tiene valor
   */
  has(field: string): boolean {
    const value = this.data[field];
    return value !== undefined && value !== null && value !== '';
  }

  // ============================================
  // CAMPOS UNIVERSALES (requeridos o muy comunes)
  // ============================================

  get id(): string | null {
    return this.get('id');
  }

  get name(): string | null {
    // Buscar por 'proposedName' que es la key correcta en FieldDefinition.REQUIRED_FIELDS
    return this.get('proposedName');
  }

  get establishmentType(): string | null {
    return this.get('establishmentType');
  }

  // Dirección - Campos universales
  get streetType(): string | null {
    return this.get('streetType');
  }

  get streetName(): string | null {
    return this.get('streetName');
  }

  get streetNumber(): string | null {
    return this.get('streetNumber');
  }

  get additionalInfo(): string | null {
    return this.get('additionalInfo');
  }

  get postalCode(): string | null {
    return this.get('postalCode');
  }

  // Coordenadas - Universales
  get latitude(): string | null {
    return this.get('latitude');
  }

  get longitude(): string | null {
    return this.get('longitude');
  }

  // ============================================
  // CAMPOS OPCIONALES (específicos de ciertas ciudades)
  // ============================================

  // Distrito - Solo relevante para ciertas ciudades (Madrid, etc.)
  get district(): string | null {
    return this.get('district');
  }

  get neighborhood(): string | null {
    return this.get('neighborhood');
  }

  // ============================================
  // RESPONSABLE Y CONTACTO
  // ============================================

  get submitterName(): string | null {
    return this.get('submitterName');
  }

  get submitterEmail(): string | null {
    return this.get('submitterEmail');
  }

  get ownership(): string | null {
    return this.get('ownership');
  }

  get localOwnership(): string | null {
    return this.get('localOwnership');
  }

  get localUse(): string | null {
    return this.get('localUse');
  }

  // ============================================
  // HORARIOS
  // ============================================

  get scheduleDescription(): string | null {
    return this.get('scheduleDescription');
  }

  get weekdayOpening(): string | null {
    return this.get('weekdayOpening');
  }

  get weekdayClosing(): string | null {
    return this.get('weekdayClosing');
  }

  get saturdayOpening(): string | null {
    return this.get('saturdayOpening');
  }

  get saturdayClosing(): string | null {
    return this.get('saturdayClosing');
  }

  get sundayOpening(): string | null {
    return this.get('sundayOpening');
  }

  get sundayClosing(): string | null {
    return this.get('sundayClosing');
  }

  get has24hSurveillance(): boolean {
    const value = this.get('has24hSurveillance')?.toLowerCase().trim();
    return value === 'sí' || value === 'si' || value === 'yes' || value === 'true' || value === '1';
  }

  // ============================================
  // IMÁGENES Y DESCRIPCIÓN
  // ============================================

  get photo1Url(): string | null {
    return this.get('photo1Url');
  }

  get photo2Url(): string | null {
    return this.get('photo2Url');
  }

  get accessDescription(): string | null {
    return this.get('accessDescription');
  }

  get observations(): string | null {
    return this.get('observations');
  }

  // ============================================
  // OTROS CAMPOS
  // ============================================

  get provisionalNumber(): string | null {
    return this.get('provisionalNumber');
  }

  get startTime(): string | null {
    return this.get('startTime');
  }

  get endTime(): string | null {
    return this.get('endTime');
  }

  // ============================================
  // VALIDACIONES UNIVERSALES
  // ============================================

  /**
   * Valida que la fila tenga los campos mínimos requeridos UNIVERSALES
   * Solo son obligatorios: nombre (proposedName), nombre de calle y número de calle
   * NO asume campos específicos de ninguna ciudad
   */
  hasMinimumRequiredFields(): boolean {
    // Validar directamente las keys para mayor claridad
    const proposedName = this.get('proposedName');
    const streetName = this.get('streetName');
    const streetNumber = this.get('streetNumber');
    
    return !!(proposedName && streetName && streetNumber);
  }

  /**
   * Obtiene el objeto completo para guardar en observaciones
   */
  toJSON(): Record<string, string> {
    return { ...this.data };
  }
}
