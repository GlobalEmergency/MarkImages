import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface MadridAddressMatch {
  id: number;
  codVia: number;
  viaClase: string | null;
  viaPar: string | null;
  viaNombre: string | null;
  viaNombreAcentos: string | null;
  numero: string | null;
  distrito: number | null;
  codPostal: string | null;
  latitud: number | null;
  longitud: number | null;
  distance?: number;
  confidence: number;
}

export interface ValidationResult {
  isValid: boolean;
  suggestions: MadridAddressMatch[];
  errors: string[];
  warnings: string[];
}

export interface GeographicValidation {
  postalCodeMatch: boolean;
  districtMatch: boolean;
  coordinatesDistance: number | null;
  coordinatesValid: boolean;
  suggestedData: {
    codPostal?: string;
    distrito?: number;
    latitud?: number;
    longitud?: number;
    viaNombreAcentos?: string;
  };
}

export class MadridGeocodingService {
  
  /**
   * Busca direcciones que coincidan con los criterios dados
   */
  async searchAddresses(
    streetName: string,
    streetNumber?: string,
    district?: number,
    postalCode?: string,
    limit: number = 10
  ): Promise<MadridAddressMatch[]> {
    // TODO: Implement with correct Madrid address tables
    console.warn('Madrid address search not implemented - returning empty results', {
      streetName,
      streetNumber,
      district,
      postalCode,
      limit
    });
    return [];
  }
  
  /**
   * Encuentra la dirección más cercana geográficamente
   */
  async findClosestAddress(
    latitude: number,
    longitude: number,
    maxDistanceKm: number = 1
  ): Promise<MadridAddressMatch[]> {
    // Usar una consulta SQL raw para calcular distancias
    const results = await prisma.$queryRaw<Array<{
      id: number;
      cod_via: number;
      via_clase: string | null;
      via_par: string | null;
      via_nombre: string | null;
      via_nombre_acentos: string | null;
      numero: string | null;
      distrito: number | null;
      cod_postal: string | null;
      latitud: number | null;
      longitud: number | null;
      distance: number;
    }>>`
      SELECT 
        id,
        cod_via,
        via_clase,
        via_par,
        via_nombre,
        via_nombre_acentos,
        numero,
        distrito,
        cod_postal,
        latitud,
        longitud,
        (
          6371 * acos(
            cos(radians(${latitude})) * 
            cos(radians(latitud)) * 
            cos(radians(longitud) - radians(${longitude})) + 
            sin(radians(${latitude})) * 
            sin(radians(latitud))
          )
        ) AS distance
      FROM madrid_addresses 
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(${latitude})) * 
            cos(radians(latitud)) * 
            cos(radians(longitud) - radians(${longitude})) + 
            sin(radians(${latitude})) * 
            sin(radians(latitud))
          )
        ) <= ${maxDistanceKm}
      ORDER BY distance
      LIMIT 10
    `;
    
    return results.map(result => ({
      id: result.id,
      codVia: result.cod_via,
      viaClase: result.via_clase,
      viaPar: result.via_par,
      viaNombre: result.via_nombre,
      viaNombreAcentos: result.via_nombre_acentos,
      numero: result.numero,
      distrito: result.distrito,
      codPostal: result.cod_postal,
      latitud: result.latitud,
      longitud: result.longitud,
      distance: result.distance,
      confidence: 1 - (result.distance / maxDistanceKm)
    }));
  }
  
  /**
   * Valida datos geográficos contra la base de datos oficial
   */
  async validateGeographicData(
    streetName: string,
    streetNumber: string | null,
    postalCode: string,
    district: string,
    latitude: number,
    longitude: number
  ): Promise<GeographicValidation> {
    const result: GeographicValidation = {
      postalCodeMatch: false,
      districtMatch: false,
      coordinatesDistance: null,
      coordinatesValid: false,
      suggestedData: {}
    };
    
    // Validar datos de entrada
    if (!streetName || !postalCode || !district) {
      console.warn('Datos de entrada incompletos para validación geográfica');
      return result;
    }
    
    // Validar coordenadas (deben estar en el rango de Madrid)
    if (!this.isValidMadridCoordinate(latitude, longitude)) {
      console.warn('Coordenadas fuera del rango válido para Madrid:', latitude, longitude);
      result.coordinatesValid = false;
    }
    
    // Extraer número de distrito de manera robusta
    const districtNumber = this.extractDistrictNumber(district);
    if (districtNumber === 0) {
      console.warn('No se pudo extraer número de distrito válido:', district);
    }
    
    try {
      // Buscar direcciones similares
      const matches = await this.searchAddresses(
        streetName,
        streetNumber || undefined,
        districtNumber > 0 ? districtNumber : undefined,
        postalCode,
        5
      );
    
      if (matches.length > 0) {
        const bestMatch = matches[0];
        
        // Validar código postal
        result.postalCodeMatch = bestMatch.codPostal === postalCode;
        if (!result.postalCodeMatch && bestMatch.codPostal) {
          result.suggestedData.codPostal = bestMatch.codPostal;
        }
        
        // Validar distrito
        result.districtMatch = bestMatch.distrito?.toString() === district;
        if (!result.districtMatch && bestMatch.distrito) {
          result.suggestedData.distrito = bestMatch.distrito;
        }
        
        // Validar coordenadas (si están disponibles)
        if (bestMatch.latitud && bestMatch.longitud) {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            bestMatch.latitud,
            bestMatch.longitud
          );
          
          result.coordinatesDistance = distance;
          result.coordinatesValid = distance <= 0.02; // 20 metros
          
          if (!result.coordinatesValid) {
            result.suggestedData.latitud = bestMatch.latitud;
            result.suggestedData.longitud = bestMatch.longitud;
          }
        }
        
        // Sugerir nombre de vía normalizado
        if (bestMatch.viaNombreAcentos) {
          result.suggestedData.viaNombreAcentos = bestMatch.viaNombreAcentos;
        }
      }
    } catch (error) {
      console.error('Error en búsqueda de direcciones:', error);
    }
    
    return result;
  }
  
  /**
   * Obtiene información de distrito por código postal
   */
  async getDistrictByPostalCode(postalCode: string): Promise<number[]> {
    // TODO: Implement with correct Madrid address tables
    console.warn('District by postal code search not implemented - returning empty results', { postalCode });
    return [];
  }
  
  /**
   * Calcula la distancia entre dos puntos en kilómetros
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Calcula un score de confianza para un resultado
   */
  private calculateConfidence(
    result: {
      viaNombreAcentos?: string | null;
      numero?: string | null;
      distrito?: number | null;
      codPostal?: string | null;
    },
    searchStreet: string,
    searchNumber?: string,
    searchDistrict?: number,
    searchPostalCode?: string
  ): number {
    let confidence = 0;
    
    // Coincidencia de nombre de vía (40%)
    if (result.viaNombreAcentos) {
      const similarity = this.calculateStringSimilarity(
        searchStreet.toLowerCase(),
        result.viaNombreAcentos.toLowerCase()
      );
      confidence += similarity * 0.4;
    }
    
    // Coincidencia de número (20%)
    if (searchNumber && result.numero) {
      confidence += (searchNumber === result.numero) ? 0.2 : 0;
    } else if (!searchNumber) {
      confidence += 0.1; // Bonus parcial si no se especifica número
    }
    
    // Coincidencia de distrito (20%)
    if (searchDistrict && result.distrito) {
      confidence += (searchDistrict === result.distrito) ? 0.2 : 0;
    }
    
    // Coincidencia de código postal (20%)
    if (searchPostalCode && result.codPostal) {
      confidence += (searchPostalCode === result.codPostal) ? 0.2 : 0;
    }
    
    return Math.min(confidence, 1);
  }
  
  /**
   * Calcula similitud entre dos strings
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calcula la distancia de Levenshtein entre dos strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Valida si las coordenadas están dentro del rango válido para Madrid
   */
  private isValidMadridCoordinate(latitude: number, longitude: number): boolean {
    // Rango aproximado de Madrid
    // Latitud: 40.3 - 40.6
    // Longitud: -3.9 - -3.5
    return (
      latitude >= 40.2 && latitude <= 40.7 &&
      longitude >= -4.0 && longitude <= -3.4
    );
  }

  /**
   * Extrae el número del distrito de un string como "2. Arganzuela"
   */
  private extractDistrictNumber(distrito: string): number {
    if (!distrito || typeof distrito !== 'string') {
      console.warn('Distrito inválido:', distrito);
      return 0;
    }
    
    // Limpiar el string
    const cleanDistrict = distrito.trim();
    
    // Intentar varios patrones comunes
    const patterns = [
      /^(\d+)\.\s*/, // "2. Arganzuela"
      /^(\d+)\s*-\s*/, // "2 - Arganzuela"
      /^(\d+)\s+/, // "2 Arganzuela"
      /^(\d+)$/, // Solo número
      /distrito\s*(\d+)/i, // "Distrito 2"
    ];
    
    for (const pattern of patterns) {
      const match = cleanDistrict.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= 1 && num <= 21) { // Madrid tiene 21 distritos
          return num;
        }
      }
    }
    
    // Si no coincide con ningún patrón, intentar convertir directamente
    const parsed = parseInt(cleanDistrict, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 21) {
      return parsed;
    }
    
    console.warn('No se pudo extraer número de distrito válido de:', distrito);
    return 0;
  }
}

export const madridGeocodingService = new MadridGeocodingService();
