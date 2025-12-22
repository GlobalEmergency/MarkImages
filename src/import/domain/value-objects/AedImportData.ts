/**
 * AED Import Data Value Object
 *
 * Representa los datos mapeados de un registro de importación de AED.
 * Inmutable y con datos ya normalizados del CSV.
 */

export interface AedImportDataProps {
  // Identificadores
  id?: string;
  code?: string;
  externalReference?: string;

  // Datos básicos
  proposedName: string;
  establishmentType?: string;
  localOwnership?: string;
  ownership?: string;
  function?: string;

  // Ubicación
  streetType?: string;
  streetName?: string;
  streetNumber?: string;
  postalCode?: string;
  city?: string;
  cityCode?: string;
  cityName?: string;
  district?: string;
  districtCode?: string;
  neighborhood?: string;
  neighborhoodName?: string;

  // Coordenadas
  latitude?: string;
  longitude?: string;

  // Horarios
  is24x7?: string;
  openingMonFri?: string;
  closingMonFri?: string;
  openingSat?: string;
  closingSat?: string;
  openingSun?: string;
  closingSun?: string;

  // Seguridad y acceso
  has24hSurveillance?: string;
  accessDescription?: string;

  // Multimedia
  photo1Url?: string;
  photo2Url?: string;
  photo3Url?: string;

  // Comentarios
  freeComment?: string;
}

export class AedImportData {
  private constructor(private readonly props: AedImportDataProps) {}

  static create(props: AedImportDataProps): AedImportData {
    return new AedImportData(props);
  }

  // Identificadores
  get id(): string | undefined {
    return this.props.id;
  }

  get code(): string | undefined {
    return this.props.code;
  }

  get externalReference(): string | undefined {
    return this.props.externalReference;
  }

  // Datos básicos
  get proposedName(): string {
    return this.props.proposedName;
  }

  get establishmentType(): string | undefined {
    return this.props.establishmentType;
  }

  get localOwnership(): string | undefined {
    return this.props.localOwnership;
  }

  get ownership(): string | undefined {
    return this.props.ownership;
  }

  get function(): string | undefined {
    return this.props.function;
  }

  // Ubicación
  get streetType(): string | undefined {
    return this.props.streetType;
  }

  get streetName(): string | undefined {
    return this.props.streetName;
  }

  get streetNumber(): string | undefined {
    return this.props.streetNumber;
  }

  get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  get city(): string | undefined {
    return this.props.city;
  }

  get cityCode(): string | undefined {
    return this.props.cityCode;
  }

  get cityName(): string | undefined {
    return this.props.cityName;
  }

  get district(): string | undefined {
    return this.props.district;
  }

  get districtCode(): string | undefined {
    return this.props.districtCode;
  }

  get neighborhood(): string | undefined {
    return this.props.neighborhood;
  }

  get neighborhoodName(): string | undefined {
    return this.props.neighborhoodName;
  }

  // Coordenadas
  get latitude(): string | undefined {
    return this.props.latitude;
  }

  get longitude(): string | undefined {
    return this.props.longitude;
  }

  // Horarios
  get is24x7(): string | undefined {
    return this.props.is24x7;
  }

  get openingMonFri(): string | undefined {
    return this.props.openingMonFri;
  }

  get closingMonFri(): string | undefined {
    return this.props.closingMonFri;
  }

  get openingSat(): string | undefined {
    return this.props.openingSat;
  }

  get closingSat(): string | undefined {
    return this.props.closingSat;
  }

  get openingSun(): string | undefined {
    return this.props.openingSun;
  }

  get closingSun(): string | undefined {
    return this.props.closingSun;
  }

  // Seguridad
  get has24hSurveillance(): string | undefined {
    return this.props.has24hSurveillance;
  }

  get accessDescription(): string | undefined {
    return this.props.accessDescription;
  }

  // Multimedia
  get photo1Url(): string | undefined {
    return this.props.photo1Url;
  }

  get photo2Url(): string | undefined {
    return this.props.photo2Url;
  }

  get photo3Url(): string | undefined {
    return this.props.photo3Url;
  }

  // Comentarios
  get freeComment(): string | undefined {
    return this.props.freeComment;
  }

  /**
   * Convierte a objeto plano para persistencia
   */
  toPlainObject(): AedImportDataProps {
    return { ...this.props };
  }
}
