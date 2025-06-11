// Tipos para el nuevo sistema de validación de direcciones

export interface AddressSearchCriteria {
  streetType?: string;
  streetName: string;
  streetNumber?: string;
  postalCode?: string;
  district?: string | number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface AddressSearchResult {
  id: number;
  viaId: number;
  codigoVia: number;
  claseVia: string;
  nombreVia: string;
  nombreViaAcentos: string;
  numero?: number;
  codigoPostal?: string;
  distrito: number;
  distritoNombre: string;
  barrio?: string;
  latitud: number;
  longitud: number;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'geographic';
  distance?: number; // En metros si es búsqueda geográfica
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'geographic';
  suggestions: AddressSearchResult[];
  errors: string[];
  warnings: string[];
}

export interface AddressValidationDetails {
  streetName: {
    input: string;
    official?: string;
    needsCorrection: boolean;
    similarity: number;
  };
  streetType: {
    input: string;
    official?: string;
    needsCorrection: boolean;
  };
  streetNumber: {
    input?: string;
    official?: number;
    needsCorrection: boolean;
    inValidRange: boolean;
  };
  postalCode: {
    input: string;
    official?: string;
    needsCorrection: boolean;
  };
  district: {
    input: string | number;
    official?: number;
    needsCorrection: boolean;
  };
  coordinates: {
    input?: { latitude: number; longitude: number };
    official?: { latitude: number; longitude: number };
    distance?: number;
    needsReview: boolean;
  };
}

export interface ComprehensiveAddressValidation {
  searchResult: ValidationResult;
  validationDetails: AddressValidationDetails;
  overallStatus: 'valid' | 'needs_review' | 'invalid';
  recommendedActions: string[];
  appliedCorrections?: {
    streetName?: string;
    streetType?: string;
    streetNumber?: string;
    postalCode?: string;
    district?: number;
    coordinates?: { latitude: number; longitude: number };
  };
}

// Interfaces para repositorios (SOLID - Dependency Inversion)
export interface IAddressRepository {
  searchByExactMatch(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]>;
  searchByFuzzyMatch(criteria: AddressSearchCriteria, threshold?: number): Promise<AddressSearchResult[]>;
  searchByGeographicProximity(
    latitude: number, 
    longitude: number, 
    radiusMeters?: number
  ): Promise<AddressSearchResult[]>;
  findByViaAndNumber(viaId: number, numero?: number): Promise<AddressSearchResult[]>;
}

export interface IDistrictRepository {
  findByCode(codigo: number): Promise<District | null>;
  findByName(nombre: string): Promise<District[]>;
  findByPostalCode(codigoPostal: string): Promise<District[]>;
}

export interface IStreetRepository {
  findByName(nombre: string, claseVia?: string): Promise<Street[]>;
  findByCode(codigo: number): Promise<Street | null>;
  searchSimilar(nombre: string, threshold?: number): Promise<Street[]>;
}

export interface IViaRangeRepository {
  findValidRanges(viaId: number, distritoId: number): Promise<ViaRange[]>;
  isNumberInRange(viaId: number, distritoId: number, numero: number): Promise<boolean>;
}

// Interfaces para estrategias de búsqueda (SOLID - Strategy Pattern)
export interface ISearchStrategy {
  search(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]>;
  getConfidenceLevel(): number;
  getStrategyName(): string;
}

export interface IValidationStrategy {
  validate(
    input: AddressSearchCriteria, 
    officialData: AddressSearchResult[]
  ): Promise<AddressValidationDetails>;
}

// Tipos de datos de la base de datos
export interface District {
  id: number;
  codigoDistrito: number;
  codigoTexto: string;
  nombre: string;
  nombreNormalizado: string;
  shapeLength?: number;
  shapeArea?: number;
  fechaAlta?: Date;
  fechaBaja?: Date;
  observaciones?: string;
}

export interface Neighborhood {
  id: number;
  distritoId: number;
  codigoBarrio: number;
  codigoDistritoBarrio: number;
  numeroBarrio: number;
  nombre: string;
  nombreNormalizado: string;
  nombreMayuscula: string;
  shapeLength?: number;
  shapeArea?: number;
  fechaAlta?: Date;
  fechaBaja?: Date;
}

export interface Street {
  id: number;
  codigoVia: number;
  claseVia: string;
  particula?: string;
  nombre: string;
  nombreConAcentos: string;
  nombreNormalizado: string;
  codigoViaInicio?: number;
  claseInicio?: string;
  particulaInicio?: string;
  nombreInicio?: string;
  codigoViaFin?: number;
  claseFin?: string;
  particulaFin?: string;
  nombreFin?: string;
}

export interface ViaRange {
  id: number;
  viaId: number;
  distritoId: number;
  barrioId?: number;
  numeroImparMin?: number;
  numeroImparMax?: number;
  numeroParMin?: number;
  numeroParMax?: number;
}

export interface Address {
  id: number;
  viaId: number;
  distritoId: number;
  barrioId?: number;
  claseAplicacion?: string;
  numero?: number;
  calificador?: string;
  tipoPunto?: string;
  codigoPunto?: number;
  codigoPostal?: string;
  latitud: number;
  longitud: number;
  utmXEtrs?: number;
  utmYEtrs?: number;
  utmXEd?: number;
  utmYEd?: number;
  anguloRotulacion?: number;
}

// Configuración para búsquedas
export interface SearchConfig {
  fuzzyThreshold: number;
  maxResults: number;
  geographicRadiusMeters: number;
  coordinateToleranceMeters: number;
  enableFuzzySearch: boolean;
  enableGeographicSearch: boolean;
  prioritizeExactMatches: boolean;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  fuzzyThreshold: 0.6,
  maxResults: 10,
  geographicRadiusMeters: 1000,
  coordinateToleranceMeters: 100,
  enableFuzzySearch: true,
  enableGeographicSearch: true,
  prioritizeExactMatches: true
};
