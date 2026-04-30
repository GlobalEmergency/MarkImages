/**
 * Value Object: Representa una fila del CSV de importaciÃ³n
 * Capa de Dominio
 */

export interface CsvRowData {
  Id: string;
  "Correo electrÃ³nico": string;
  Nombre: string;
  "NÃºmero provisional DEA": string;
  "Referencia externa": string;
  "Tipo de establecimiento": string;
  "Titularidad del local": string;
  "Uso del local": string;
  Titularidad: string;
  "Propuesta de denominaciÃ³n": string;
  "Tipo de vÃ­a": string;
  "Nombre de la vÃ­a": string;
  "NÃºmero de la vÃ­a": string;
  "Complemento de direcciÃ³n": string;
  "CÃ³digo postal": string;
  Distrito: string;
  Planta: string;
  "UbicaciÃ³n especÃ­fica": string;
  "Coordenadas-Latitud (norte)": string;
  "Coordenadas-Longitud (oeste, por lo tanto, negativa)": string;
  "Horario de apertura del establecimiento": string;
  "Hora de APERTURA de lunes a viernes": string;
  "Hora de CIERRE de lunes a viernes": string;
  "Hora de APERTURA los sÃ¡bados": string;
  "Hora de CIERRE los sÃ¡bados": string;
  "Hora de APERTURA los domingos": string;
  "Hora de CIERRE los domingos": string;
  "Â¿Tiene vigilante 24 horas al dÃ­a que pueda facilitar el desfibrilador en caso necesario aunque estÃ© cerrado?": string;
  "Foto 1": string;
  "Foto 2": string;

  // NEW SIMPLIFIED FIELDS
  "Instrucciones de acceso": string;
  "Comentarios pÃºblicos": string;

  // DEPRECATED - Mantener para compatibilidad durante transiciÃ³n
  "DescripciÃ³n acceso": string;
  "Referencias visibles": string;
  "Advertencias acceso": string;
  "Observaciones ubicaciÃ³n": string;
  "Comentario libre": string;

  // Optional fields that may exist in some CSV formats
  "Hora de inicio"?: string;
  "Hora de finalizaciÃ³n"?: string;
}

export class CsvRow {
  constructor(private readonly data: CsvRowData) {}

  get id(): string {
    return this.data.Id;
  }

  get submitterEmail(): string {
    return this.data["Correo electrÃ³nico"];
  }

  get submitterName(): string {
    return this.data.Nombre;
  }

  get provisionalNumber(): string {
    return this.data["NÃºmero provisional DEA"];
  }

  get proposedName(): string {
    return this.data["Propuesta de denominaciÃ³n"];
  }

  // Alias para compatibilidad con DynamicCsvRow
  get name(): string {
    return this.proposedName;
  }

  get establishmentType(): string {
    return this.data["Tipo de establecimiento"];
  }

  get streetType(): string {
    return this.data["Tipo de vÃ­a"];
  }

  get streetName(): string {
    return this.data["Nombre de la vÃ­a"];
  }

  get streetNumber(): string {
    return this.data["NÃºmero de la vÃ­a"];
  }

  get additionalInfo(): string {
    return this.data["Complemento de direcciÃ³n"];
  }

  get postalCode(): string {
    return this.data["CÃ³digo postal"];
  }

  get district(): string {
    return this.data.Distrito;
  }

  get latitude(): string {
    return this.data["Coordenadas-Latitud (norte)"];
  }

  get longitude(): string {
    return this.data["Coordenadas-Longitud (oeste, por lo tanto, negativa)"];
  }

  get photo1Url(): string {
    return this.data["Foto 1"];
  }

  get photo2Url(): string {
    return this.data["Foto 2"];
  }

  get accessDescription(): string {
    return this.data["DescripciÃ³n acceso"];
  }

  get freeComment(): string {
    return this.data["Comentario libre"];
  }

  get scheduleDescription(): string {
    return this.data["Horario de apertura del establecimiento"];
  }

  get weekdayOpening(): string {
    return this.data["Hora de APERTURA de lunes a viernes"];
  }

  get weekdayClosing(): string {
    return this.data["Hora de CIERRE de lunes a viernes"];
  }

  get saturdayOpening(): string {
    return this.data["Hora de APERTURA los sÃ¡bados"];
  }

  get saturdayClosing(): string {
    return this.data["Hora de CIERRE los sÃ¡bados"];
  }

  get sundayOpening(): string {
    return this.data["Hora de APERTURA los domingos"];
  }

  get sundayClosing(): string {
    return this.data["Hora de CIERRE los domingos"];
  }

  get has24hSurveillance(): boolean {
    const value = this.data[
      "Â¿Tiene vigilante 24 horas al dÃ­a que pueda facilitar el desfibrilador en caso necesario aunque estÃ© cerrado?"
    ]
      ?.toLowerCase()
      .trim();
    return value === "sÃ­" || value === "si" || value === "yes";
  }

  get ownership(): string {
    return this.data.Titularidad;
  }

  get localOwnership(): string {
    return this.data["Titularidad del local"];
  }

  get localUse(): string {
    return this.data["Uso del local"];
  }

  get startTime(): string {
    return this.data["Hora de inicio"] || "";
  }

  get endTime(): string {
    return this.data["Hora de finalizaciÃ³n"] || "";
  }

  /**
   * Valida que la fila tenga los campos mÃ­nimos requeridos
   * Solo son obligatorios: nombre, nombre de calle y nÃºmero de calle
   */
  hasMinimumRequiredFields(): boolean {
    return !!(this.proposedName && this.streetName && this.streetNumber);
  }

  /**
   * Obtiene el objeto completo para guardar en observaciones
   */
  toJSON(): CsvRowData {
    return { ...this.data };
  }
}
