import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OfficialAddressData {
  id: number;
  codVia: number;
  tipoVia: string;
  nombreVia: string;
  numeroVia: string | null;
  codigoPostal: string;
  distrito: number;
  latitud: number | null;
  longitud: number | null;
  confidence: number;
}

export interface AddressSearchResult {
  found: boolean;
  exactMatch: boolean;
  officialData: OfficialAddressData | null;
  alternatives: OfficialAddressData[];
  searchCriteria: {
    tipoVia: string;
    nombreVia: string;
    numeroVia: string | null;
  };
}

export interface AddressVerificationResult {
  nameNormalization: {
    userInput: {
      tipoVia: string;
      nombreVia: string;
    };
    official: {
      tipoVia: string;
      nombreVia: string;
    } | null;
    needsCorrection: boolean;
    suggestions: string[];
  };
  postalCodeMatch: {
    userInput: string;
    official: string | null;
    matches: boolean;
    needsCorrection: boolean;
  };
  districtMatch: {
    userInput: string;
    userInputNumber: number;
    official: number | null;
    matches: boolean;
    needsCorrection: boolean;
  };
  coordinatesComparison: {
    userCoordinates: {
      lat: number;
      lng: number;
    } | null;
    officialCoordinates: {
      lat: number;
      lng: number;
    } | null;
    distanceInMeters: number | null;
    distanceInKm: number | null;
    isWithinAcceptableRange: boolean;
    needsReview: boolean;
  };
}

export interface OrderedAddressValidation {
  step1_officialSearch: AddressSearchResult;
  step2_verification: AddressVerificationResult;
  overallResult: {
    isValid: boolean;
    needsReview: boolean;
    corrections: string[];
    confidence: number;
    recommendedActions: string[];
  };
}

export class AddressValidationService {
  
  /**
   * Valida una dirección siguiendo el orden específico:
   * 1º Buscar en base de datos oficial
   * 2º Verificar y normalizar datos
   */
  async validateAddressInOrder(
    tipoVia: string,
    nombreVia: string,
    numeroVia: string | null,
    codigoPostal: string,
    distrito: string,
    userCoordinates?: { lat: number; lng: number }
  ): Promise<OrderedAddressValidation> {
    
    // PASO 1: Buscar en base de datos oficial del Ayuntamiento de Madrid
    const step1Result = await this.searchInOfficialDatabase(
      tipoVia,
      nombreVia,
      numeroVia
    );
    
    // PASO 2: Verificar y normalizar con datos oficiales
    const step2Result = await this.verifyAndNormalizeAddress(
      { tipoVia, nombreVia },
      codigoPostal,
      distrito,
      step1Result.officialData,
      userCoordinates
    );
    
    // Calcular resultado general
    const overallResult = this.calculateOverallResult(step1Result, step2Result);
    
    return {
      step1_officialSearch: step1Result,
      step2_verification: step2Result,
      overallResult
    };
  }
  
  /**
   * PASO 1: Busca la dirección en la base de datos oficial de Madrid
   */
  private async searchInOfficialDatabase(
    tipoVia: string,
    nombreVia: string,
    numeroVia: string | null
  ): Promise<AddressSearchResult> {
    
    const result: AddressSearchResult = {
      found: false,
      exactMatch: false,
      officialData: null,
      alternatives: [],
      searchCriteria: { tipoVia, nombreVia, numeroVia }
    };
    
    try {
      // 1.1 Búsqueda exacta completa
      const exactMatch = await this.findExactAddressMatch(tipoVia, nombreVia, numeroVia);
      
      if (exactMatch) {
        result.found = true;
        result.exactMatch = true;
        result.officialData = exactMatch;
        return result;
      }
      
      // 1.2 Búsqueda exacta sin número (para calles sin numeración específica)
      if (numeroVia) {
        const streetMatch = await this.findExactAddressMatch(tipoVia, nombreVia, null);
        if (streetMatch) {
          result.found = true;
          result.exactMatch = false;
          result.officialData = streetMatch;
          
          // Buscar números específicos en esa calle
          const numberedAddresses = await this.findNumberedAddressesInStreet(
            streetMatch.codVia,
            numeroVia
          );
          result.alternatives = numberedAddresses;
          return result;
        }
      }
      
      // 1.3 Búsqueda con tolerancia a errores tipográficos
      const similarAddresses = await this.findSimilarAddresses(
        tipoVia,
        nombreVia,
        numeroVia
      );
      
      if (similarAddresses.length > 0) {
        result.found = true;
        result.exactMatch = false;
        result.alternatives = similarAddresses;
        
        // Tomar la mejor coincidencia como sugerencia principal
        const bestMatch = similarAddresses[0];
        if (bestMatch.confidence >= 0.8) {
          result.officialData = bestMatch;
        }
      }
      
    } catch (error) {
      console.error('Error en búsqueda oficial de dirección:', error);
    }
    
    return result;
  }
  
  /**
   * PASO 2: Verifica y normaliza los datos con la información oficial
   */
  private async verifyAndNormalizeAddress(
    userInput: { tipoVia: string; nombreVia: string },
    userCodigoPostal: string,
    userDistrito: string,
    officialData: OfficialAddressData | null,
    userCoordinates?: { lat: number; lng: number }
  ): Promise<AddressVerificationResult> {
    
    const result: AddressVerificationResult = {
      nameNormalization: {
        userInput,
        official: null,
        needsCorrection: false,
        suggestions: []
      },
      postalCodeMatch: {
        userInput: userCodigoPostal,
        official: null,
        matches: false,
        needsCorrection: false
      },
      districtMatch: {
        userInput: userDistrito,
        userInputNumber: this.extractDistrictNumber(userDistrito),
        official: null,
        matches: false,
        needsCorrection: false
      },
      coordinatesComparison: {
        userCoordinates: userCoordinates || null,
        officialCoordinates: null,
        distanceInMeters: null,
        distanceInKm: null,
        isWithinAcceptableRange: false,
        needsReview: false
      }
    };
    
    if (!officialData) {
      // Sin datos oficiales, no podemos verificar
      result.nameNormalization.suggestions.push('No se encontraron datos oficiales para verificar');
      return result;
    }
    
    // 2.1 Verificar y normalizar nombre de vía
    result.nameNormalization.official = {
      tipoVia: officialData.tipoVia,
      nombreVia: officialData.nombreVia
    };
    
    const nameNeedsCorrection = 
      !this.areStringsEquivalent(userInput.tipoVia, officialData.tipoVia) ||
      !this.areStringsEquivalent(userInput.nombreVia, officialData.nombreVia);
    
    result.nameNormalization.needsCorrection = nameNeedsCorrection;
    
    if (nameNeedsCorrection) {
      result.nameNormalization.suggestions.push(
        `Nombre oficial: ${officialData.tipoVia} ${officialData.nombreVia}`
      );
    }
    
    // 2.2 Verificar código postal
    result.postalCodeMatch.official = officialData.codigoPostal;
    result.postalCodeMatch.matches = userCodigoPostal === officialData.codigoPostal;
    result.postalCodeMatch.needsCorrection = !result.postalCodeMatch.matches;
    
    // 2.3 Verificar distrito
    result.districtMatch.official = officialData.distrito;
    result.districtMatch.matches = result.districtMatch.userInputNumber === officialData.distrito;
    result.districtMatch.needsCorrection = !result.districtMatch.matches;
    
    // 2.4 Comparar coordenadas
    if (officialData.latitud && officialData.longitud) {
      result.coordinatesComparison.officialCoordinates = {
        lat: officialData.latitud,
        lng: officialData.longitud
      };
      
      if (userCoordinates) {
        const distanceKm = this.calculateDistance(
          userCoordinates.lat,
          userCoordinates.lng,
          officialData.latitud,
          officialData.longitud
        );
        
        const distanceMeters = distanceKm * 1000;
        
        result.coordinatesComparison.distanceInKm = distanceKm;
        result.coordinatesComparison.distanceInMeters = distanceMeters;
        
        // Considerar aceptable si está dentro de 100 metros
        result.coordinatesComparison.isWithinAcceptableRange = distanceMeters <= 100;
        result.coordinatesComparison.needsReview = distanceMeters > 100;
      }
    }
    
    return result;
  }
  
  /**
   * Calcula distancia entre dos puntos en kilómetros usando la fórmula de Haversine
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Busca coincidencia exacta en madrid_addresses
   */
  private async findExactAddressMatch(
    tipoVia: string,
    nombreVia: string,
    numeroVia: string | null
  ): Promise<OfficialAddressData | null> {
    
    const baseConditions = {
      AND: [
        {
          OR: [
            { viaClase: { equals: tipoVia, mode: 'insensitive' as const } },
            { viaPar: { equals: tipoVia, mode: 'insensitive' as const } }
          ]
        },
        {
          OR: [
            { viaNombreAcentos: { equals: nombreVia, mode: 'insensitive' as const } },
            { viaNombre: { equals: nombreVia.toUpperCase(), mode: 'insensitive' as const } }
          ]
        }
      ]
    };
    
    const whereConditions = numeroVia 
      ? {
          AND: [
            ...baseConditions.AND,
            { numero: numeroVia }
          ]
        }
      : baseConditions;
    
    const address = await prisma.madridAddress.findFirst({
      where: whereConditions,
      orderBy: [
        { distrito: 'asc' },
        { numero: 'asc' }
      ]
    });
    
    if (!address) return null;
    
    return this.mapToOfficialAddressData(address, 1.0);
  }
  
  /**
   * Busca direcciones numeradas en una calle específica
   */
  private async findNumberedAddressesInStreet(
    codVia: number,
    targetNumber: string
  ): Promise<OfficialAddressData[]> {
    
    const addresses = await prisma.madridAddress.findMany({
      where: {
        codVia: codVia,
        numero: { not: null }
      },
      orderBy: { numero: 'asc' },
      take: 10
    });
    
    return addresses.map((addr: {
      id: number;
      codVia: number;
      viaClase: string | null;
      viaPar: string | null;
      viaNombre: string | null;
      viaNombreAcentos: string | null;
      numero: string | null;
      codPostal: string | null;
      distrito: number | null;
      latitud: number | null;
      longitud: number | null;
    }) => {
      const confidence = addr.numero === targetNumber ? 1.0 : 0.8;
      return this.mapToOfficialAddressData(addr, confidence);
    });
  }
  
  /**
   * Busca direcciones similares con tolerancia a errores usando consultas LIKE inteligentes
   */
  private async findSimilarAddresses(
    tipoVia: string,
    nombreVia: string,
    numeroVia: string | null,
    maxResults: number = 5
  ): Promise<OfficialAddressData[]> {
    
    try {
      // Limpiar y normalizar el nombre de vía eliminando prefijos comunes
      const cleanedName = this.cleanStreetNameForSearch(nombreVia);
      const normalizedType = this.normalizeString(tipoVia);
      
      // Crear múltiples patrones de búsqueda
      const searchPatterns = this.generateSearchPatterns(cleanedName);
      
      const results: OfficialAddressData[] = [];
      
      // Búsqueda usando consultas LIKE con patrones múltiples
      for (const pattern of searchPatterns) {
        const likeMatches = await prisma.madridAddress.findMany({
          where: {
            AND: [
              {
                OR: [
                  { viaNombreAcentos: { contains: pattern, mode: 'insensitive' } },
                  { viaNombre: { contains: pattern.toUpperCase(), mode: 'insensitive' } }
                ]
              },
              {
                OR: [
                  { viaClase: { contains: normalizedType, mode: 'insensitive' } },
                  { viaPar: { contains: normalizedType, mode: 'insensitive' } }
                ]
              }
            ]
          },
          take: 20 // Limitar por patrón
        });
        
        // Procesar resultados y calcular confianza
        for (const address of likeMatches) {
          if (!address.viaNombreAcentos || !address.viaClase) continue;
          
          const confidence = this.calculateSmartConfidence(
            nombreVia,
            tipoVia,
            numeroVia,
            address,
            pattern
          );
          
          if (confidence >= 0.5) { // Umbral más bajo para LIKE
            results.push(this.mapToOfficialAddressData(address, confidence));
          }
        }
      }
      
      // Si no hay suficientes resultados, hacer búsqueda más amplia
      if (results.length < 3) {
        const broadResults = await this.findBroadMatches(cleanedName, normalizedType);
        results.push(...broadResults);
      }
      
      // Ordenar por confianza y eliminar duplicados
      const uniqueResults = this.removeDuplicateAddresses(results);
      return uniqueResults
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);
        
    } catch (error) {
      console.error('Error buscando direcciones similares:', error);
      return [];
    }
  }
  
  /**
   * Calcula el resultado general de la validación
   */
  private calculateOverallResult(
    step1: AddressSearchResult,
    step2: AddressVerificationResult
  ): {
    isValid: boolean;
    needsReview: boolean;
    corrections: string[];
    confidence: number;
    recommendedActions: string[];
  } {
    
    const corrections: string[] = [];
    const recommendedActions: string[] = [];
    let confidence = 0;
    let needsReview = false;
    
    // Evaluar paso 1
    if (!step1.found) {
      corrections.push('Dirección no encontrada en el callejero oficial de Madrid');
      recommendedActions.push('Verificar la dirección manualmente');
      needsReview = true;
      confidence = 0;
    } else if (step1.exactMatch) {
      confidence = step1.officialData?.confidence || 1.0;
    } else {
      confidence = step1.officialData?.confidence || 0.7;
      needsReview = true;
      recommendedActions.push('Revisar la dirección sugerida');
    }
    
    // Evaluar paso 2
    if (step1.found && step1.officialData) {
      if (step2.nameNormalization.needsCorrection) {
        corrections.push('El nombre de la vía necesita normalización');
        recommendedActions.push('Aplicar nombre oficial de la vía');
        needsReview = true;
      }
      
      if (step2.postalCodeMatch.needsCorrection) {
        corrections.push(`Código postal incorrecto. Oficial: ${step2.postalCodeMatch.official}`);
        recommendedActions.push('Corregir código postal');
        needsReview = true;
        confidence *= 0.9;
      }
      
      if (step2.districtMatch.needsCorrection) {
        corrections.push(`Distrito incorrecto. Oficial: ${step2.districtMatch.official}`);
        recommendedActions.push('Corregir distrito');
        needsReview = true;
        confidence *= 0.9;
      }
    }
    
    const isValid = step1.found && 
                   !step2.postalCodeMatch.needsCorrection && 
                   !step2.districtMatch.needsCorrection;
    
    return {
      isValid,
      needsReview,
      corrections,
      confidence,
      recommendedActions
    };
  }
  
  /**
   * Mapea resultado de base de datos a estructura oficial
   */
  private mapToOfficialAddressData(address: {
    id: number;
    codVia: number;
    viaClase: string | null;
    viaPar: string | null;
    viaNombre: string | null;
    viaNombreAcentos: string | null;
    numero: string | null;
    codPostal: string | null;
    distrito: number | null;
    latitud: number | null;
    longitud: number | null;
  }, confidence: number): OfficialAddressData {
    return {
      id: address.id,
      codVia: address.codVia,
      tipoVia: address.viaClase || address.viaPar || '',
      nombreVia: address.viaNombreAcentos || address.viaNombre || '',
      numeroVia: address.numero,
      codigoPostal: address.codPostal || '',
      distrito: address.distrito || 0,
      latitud: address.latitud,
      longitud: address.longitud,
      confidence
    };
  }
  
  /**
   * Normaliza string para comparación
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, '') // Quitar puntuación
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Verifica si dos strings son equivalentes
   */
  private areStringsEquivalent(str1: string, str2: string): boolean {
    return this.normalizeString(str1) === this.normalizeString(str2);
  }
  
  /**
   * Calcula distancia de Levenshtein
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
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
   * Extrae número de distrito
   */
  private extractDistrictNumber(distrito: string): number {
    if (!distrito || typeof distrito !== 'string') {
      return 0;
    }
    
    const patterns = [
      /^(\d+)\.\s*/, // "2. Arganzuela"
      /^(\d+)\s*-\s*/, // "2 - Arganzuela"
      /^(\d+)\s+/, // "2 Arganzuela"
      /^(\d+)$/, // Solo número
      /distrito\s*(\d+)/i, // "Distrito 2"
    ];
    
    for (const pattern of patterns) {
      const match = distrito.trim().match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= 1 && num <= 21) {
          return num;
        }
      }
    }
    
    const parsed = parseInt(distrito.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 21) {
      return parsed;
    }
    
    return 0;
  }
  
  /**
   * Limpia el nombre de vía eliminando prefijos comunes para búsqueda
   */
  private cleanStreetNameForSearch(nombreVia: string): string {
    // Eliminar prefijos comunes como "DE LA", "DEL", "DE LOS", etc.
    const prefixesToRemove = [
      /^DE\s+LA\s+/i,
      /^DE\s+LAS\s+/i,
      /^DE\s+LOS\s+/i,
      /^DEL\s+/i,
      /^DE\s+/i,
      /^LA\s+/i,
      /^LAS\s+/i,
      /^LOS\s+/i,
      /^EL\s+/i
    ];
    
    let cleaned = nombreVia.trim();
    
    for (const prefix of prefixesToRemove) {
      cleaned = cleaned.replace(prefix, '');
    }
    
    return this.normalizeString(cleaned);
  }
  
  /**
   * Genera múltiples patrones de búsqueda para un nombre de vía
   */
  private generateSearchPatterns(cleanedName: string): string[] {
    const patterns: string[] = [];
    
    // Patrón completo
    patterns.push(cleanedName);
    
    // Patrón sin espacios
    patterns.push(cleanedName.replace(/\s+/g, ''));
    
    // Palabras individuales si hay más de una
    const words = cleanedName.split(/\s+/).filter(word => word.length > 2);
    if (words.length > 1) {
      patterns.push(...words);
    }
    
    // Primeras letras de cada palabra (para abreviaciones)
    if (words.length > 1) {
      const initials = words.map(word => word.charAt(0)).join('');
      if (initials.length >= 3) {
        patterns.push(initials);
      }
    }
    
    // Eliminar duplicados y patrones muy cortos
    return [...new Set(patterns)].filter(pattern => pattern.length >= 3);
  }
  
  /**
   * Calcula confianza inteligente basada en múltiples factores
   */
  private calculateSmartConfidence(
    originalName: string,
    originalType: string,
    originalNumber: string | null,
    address: any,
    searchPattern: string
  ): number {
    let confidence = 0;
    
    // Factor 1: Similitud del nombre (40%)
    const nameMatch = this.calculateNameSimilarity(originalName, address.viaNombreAcentos || address.viaNombre);
    confidence += nameMatch * 0.4;
    
    // Factor 2: Similitud del tipo de vía (30%)
    const typeMatch = this.calculateTypeSimilarity(originalType, address.viaClase || address.viaPar);
    confidence += typeMatch * 0.3;
    
    // Factor 3: Coincidencia de número (20%)
    if (originalNumber && address.numero) {
      confidence += (originalNumber === address.numero) ? 0.2 : 0.1;
    } else if (!originalNumber) {
      confidence += 0.1; // Bonus parcial si no se especifica número
    }
    
    // Factor 4: Calidad del patrón de búsqueda (10%)
    const patternQuality = this.calculatePatternQuality(searchPattern, address.viaNombreAcentos || address.viaNombre);
    confidence += patternQuality * 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Búsqueda más amplia cuando no hay suficientes resultados
   */
  private async findBroadMatches(
    cleanedName: string,
    normalizedType: string
  ): Promise<OfficialAddressData[]> {
    
    const results: OfficialAddressData[] = [];
    
    try {
      // Buscar solo por las primeras 4 letras del nombre
      const shortPattern = cleanedName.substring(0, Math.max(4, Math.floor(cleanedName.length * 0.6)));
      
      const broadMatches = await prisma.madridAddress.findMany({
        where: {
          OR: [
            { viaNombreAcentos: { startsWith: shortPattern, mode: 'insensitive' } },
            { viaNombre: { startsWith: shortPattern.toUpperCase(), mode: 'insensitive' } }
          ]
        },
        take: 15
      });
      
      for (const address of broadMatches) {
        if (!address.viaNombreAcentos || !address.viaClase) continue;
        
        const confidence = this.calculateBroadConfidence(cleanedName, normalizedType, address);
        
        if (confidence >= 0.4) {
          results.push(this.mapToOfficialAddressData(address, confidence));
        }
      }
      
    } catch (error) {
      console.error('Error en búsqueda amplia:', error);
    }
    
    return results;
  }
  
  /**
   * Calcula similitud entre nombres de vía
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const normalized1 = this.normalizeString(name1);
    const normalized2 = this.normalizeString(name2);
    
    // Coincidencia exacta
    if (normalized1 === normalized2) return 1.0;
    
    // Similitud por distancia de Levenshtein
    const distance = this.calculateLevenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return Math.max(0, 1 - (distance / maxLength));
  }
  
  /**
   * Calcula similitud entre tipos de vía
   */
  private calculateTypeSimilarity(type1: string, type2: string): number {
    if (!type1 || !type2) return 0;
    
    const normalized1 = this.normalizeString(type1);
    const normalized2 = this.normalizeString(type2);
    
    // Coincidencia exacta
    if (normalized1 === normalized2) return 1.0;
    
    // Mapeo de tipos similares
    const typeMapping: { [key: string]: string[] } = {
      'calle': ['c', 'cl', 'calle'],
      'avenida': ['av', 'avda', 'avenida'],
      'plaza': ['pl', 'plz', 'plaza'],
      'paseo': ['ps', 'pso', 'paseo'],
      'glorieta': ['gta', 'glorieta'],
      'ronda': ['rda', 'ronda']
    };
    
    for (const [canonical, variants] of Object.entries(typeMapping)) {
      if (variants.includes(normalized1) && variants.includes(normalized2)) {
        return 0.9;
      }
    }
    
    // Similitud por distancia
    const distance = this.calculateLevenshteinDistance(normalized1, normalized2);
    return Math.max(0, 1 - (distance / Math.max(normalized1.length, normalized2.length)));
  }
  
  /**
   * Calcula calidad del patrón de búsqueda
   */
  private calculatePatternQuality(pattern: string, targetName: string): number {
    if (!pattern || !targetName) return 0;
    
    const normalizedTarget = this.normalizeString(targetName);
    const normalizedPattern = this.normalizeString(pattern);
    
    // Patrón al inicio del nombre (mejor calidad)
    if (normalizedTarget.startsWith(normalizedPattern)) {
      return 1.0;
    }
    
    // Patrón contenido en el nombre
    if (normalizedTarget.includes(normalizedPattern)) {
      return 0.7;
    }
    
    // Palabras del patrón contenidas en el nombre
    const patternWords = normalizedPattern.split(/\s+/);
    const targetWords = normalizedTarget.split(/\s+/);
    
    let matchingWords = 0;
    for (const patternWord of patternWords) {
      if (targetWords.some(targetWord => targetWord.includes(patternWord))) {
        matchingWords++;
      }
    }
    
    return matchingWords / patternWords.length * 0.5;
  }
  
  /**
   * Calcula confianza para búsquedas amplias
   */
  private calculateBroadConfidence(
    cleanedName: string,
    normalizedType: string,
    address: any
  ): number {
    const nameMatch = this.calculateNameSimilarity(cleanedName, address.viaNombreAcentos || address.viaNombre);
    const typeMatch = this.calculateTypeSimilarity(normalizedType, address.viaClase || address.viaPar);
    
    return (nameMatch * 0.7) + (typeMatch * 0.3);
  }
  
  /**
   * Elimina direcciones duplicadas
   */
  private removeDuplicateAddresses(addresses: OfficialAddressData[]): OfficialAddressData[] {
    const seen = new Set<string>();
    return addresses.filter(addr => {
      const key = `${addr.codVia}-${addr.numeroVia}-${addr.distrito}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export const addressValidationService = new AddressValidationService();
