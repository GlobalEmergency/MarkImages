/**
 * Value Object: Representa una fila del CSV de importación
 * Capa de Dominio
 */

export interface CsvRowData {
  Id: string;
  "Hora de inicio": string;
  "Hora de finalización": string;
  "Correo electrónico": string;
  Nombre: string;
  "Número provisional DEA": string;
  "Tipo de establecimiento": string;
  "Titularidad del local": string;
  "Uso del local": string;
  Titularidad: string;
  "Propuesta de denominación": string;
  "Tipo de vía": string;
  "Nombre de la vía": string;
  "Número de la vía": string;
  "Complemento de dirección": string;
  "Código postal": string;
  Distrito: string;
  "Coordenadas-Latitud (norte)": string;
  "Coordenadas-Longitud (oeste, por lo tanto, negativa)": string;
  "Horario de apertura del establecimiento": string;
  "Hora de APERTURA de lunes a viernes": string;
  "Hora de CIERRE de lunes a viernes": string;
  "Hora de APERTURA los sábados": string;
  "Hora de CIERRE los sábados": string;
  "Hora de APERTURA los domingos": string;
  "Hora de CIERRE los domingos": string;
  "¿Tiene vigilante 24 horas al día que pueda facilitar el desfibrilador en caso necesario aunque esté cerrado?": string;
  "Foto 1": string;
  "Foto 2": string;
  "Descripción acceso": string;
  "Comentario libre": string;
}

export class CsvRow {
  constructor(private readonly data: CsvRowData) {}

  get id(): string {
    return this.data.Id;
  }

  get submitterEmail(): string {
    return this.data["Correo electrónico"];
  }

  get submitterName(): string {
    return this.data.Nombre;
  }

  get provisionalNumber(): string {
    return this.data["Número provisional DEA"];
  }

  get proposedName(): string {
    return this.data["Propuesta de denominación"];
  }

  get establishmentType(): string {
    return this.data["Tipo de establecimiento"];
  }

  get streetType(): string {
    return this.data["Tipo de vía"];
  }

  get streetName(): string {
    return this.data["Nombre de la vía"];
  }

  get streetNumber(): string {
    return this.data["Número de la vía"];
  }

  get additionalInfo(): string {
    return this.data["Complemento de dirección"];
  }

  get postalCode(): string {
    return this.data["Código postal"];
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
    return this.data["Descripción acceso"];
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
    return this.data["Hora de APERTURA los sábados"];
  }

  get saturdayClosing(): string {
    return this.data["Hora de CIERRE los sábados"];
  }

  get sundayOpening(): string {
    return this.data["Hora de APERTURA los domingos"];
  }

  get sundayClosing(): string {
    return this.data["Hora de CIERRE los domingos"];
  }

  get has24hSurveillance(): boolean {
    const value = this.data[
      "¿Tiene vigilante 24 horas al día que pueda facilitar el desfibrilador en caso necesario aunque esté cerrado?"
    ]
      ?.toLowerCase()
      .trim();
    return value === "sí" || value === "si" || value === "yes";
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
    return this.data["Hora de inicio"];
  }

  get endTime(): string {
    return this.data["Hora de finalización"];
  }

  /**
   * Valida que la fila tenga los campos mínimos requeridos
   */
  hasMinimumRequiredFields(): boolean {
    return !!(
      this.proposedName &&
      this.streetName &&
      this.streetNumber &&
      (this.postalCode || this.district)
    );
  }

  /**
   * Obtiene el objeto completo para guardar en observaciones
   */
  toJSON(): CsvRowData {
    return { ...this.data };
  }
}
