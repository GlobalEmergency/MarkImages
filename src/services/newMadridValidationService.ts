import { 
  AddressSearchCriteria, 
  AddressSearchResult, 
  ValidationResult, 
  AddressValidationDetails, 
  ComprehensiveAddressValidation,
  IAddressRepository,
  SearchConfig,
  DEFAULT_SEARCH_CONFIG
} from '../types/address';
import { OptimizedAddressRepository } from '../repositories/optimizedAddressRepository';

export class NewMadridValidationService {
  private addressRepository: IAddressRepository;
  private config: SearchConfig;

  constructor(
    addressRepository?: IAddressRepository,
    config: SearchConfig = DEFAULT_SEARCH_CONFIG
  ) {
    this.addressRepository = addressRepository || new OptimizedAddressRepository(config);
    this.config = config;
  }

  /**
   * Validación completa de una dirección usando la nueva estructura de BD
   */
  async validateAddress(
    streetType: string,
    streetName: string,
    streetNumber?: string,
    postalCode?: string,
    district?: string | number,
    coordinates?: { latitude: number; longitude: number }
  ): Promise<ComprehensiveAddressValidation> {
    
    const criteria: AddressSearchCriteria = {
      streetType,
      streetName,
      streetNumber,
      postalCode,
      district,
      coordinates
    };

    // Paso 1: Búsqueda en la base de datos oficial
    const searchResult = await this.performAddressSearch(criteria);
    
    // Paso 2: Validación detallada
    const validationDetails = await this.performDetailedValidation(
      criteria, 
      searchResult.suggestions
    );

    // Paso 3: Determinar estado general y acciones recomendadas
    const overallStatus = this.determineOverallStatus(searchResult, validationDetails);
    const recommendedActions = this.generateRecommendedActions(searchResult, validationDetails);

    return {
      searchResult,
      validationDetails,
      overallStatus,
      recommendedActions
    };
  }

  /**
   * Búsqueda de direcciones priorizando nombre y tipo de vía
   */
  private async performAddressSearch(criteria: AddressSearchCriteria): Promise<ValidationResult> {
    const suggestions: AddressSearchResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // ESTRATEGIA 1: Búsqueda prioritaria por nombre y tipo de vía (datos más confiables)
      const streetBasedCriteria: AddressSearchCriteria = {
        streetType: criteria.streetType,
        streetName: criteria.streetName,
        streetNumber: criteria.streetNumber,
        // Ignorar CP y distrito inicialmente para encontrar la vía correcta
        postalCode: undefined,
        district: undefined,
        coordinates: undefined
      };

      // 1.1 Búsqueda exacta por vía
      const exactStreetResults = await this.addressRepository.searchByExactMatch(streetBasedCriteria);
      
      if (exactStreetResults.length > 0) {
        // Encontramos la vía exacta, corregir otros campos automáticamente
        const correctedResults = this.correctAddressFields(criteria, exactStreetResults);
        const correctionWarnings = this.generateCorrectionWarnings(criteria, correctedResults[0]);
        
        return {
          isValid: true,
          confidence: correctedResults[0].confidence,
          matchType: 'exact',
          suggestions: correctedResults,
          errors,
          warnings: correctionWarnings
        };
      }

      // 1.2 Búsqueda fuzzy por nombre de vía
      if (this.config.enableFuzzySearch) {
        const fuzzyStreetResults = await this.addressRepository.searchByFuzzyMatch(streetBasedCriteria);
        
        if (fuzzyStreetResults.length > 0) {
          // Aplicar validaciones más permisivas para fuzzy basado en vía
          const validatedStreetResults = this.validateStreetBasedResults(criteria, fuzzyStreetResults);
          
          if (validatedStreetResults.length > 0) {
            const correctedResults = this.correctAddressFields(criteria, validatedStreetResults);
            const correctionWarnings = this.generateCorrectionWarnings(criteria, correctedResults[0]);
            correctionWarnings.unshift('Se encontró vía similar, se corrigieron otros campos automáticamente');
            
            return {
              isValid: true,
              confidence: correctedResults[0].confidence,
              matchType: 'fuzzy',
              suggestions: correctedResults,
              errors,
              warnings: correctionWarnings
            };
          }
        }
      }

      // ESTRATEGIA 2: Búsqueda completa con validación cruzada (fallback)
      if (this.config.enableFuzzySearch) {
        const fuzzyResults = await this.addressRepository.searchByFuzzyMatch(criteria);
        
        // Filtrar resultados fuzzy con validación cruzada más estricta
        const validatedFuzzyResults = this.validateCrossReferences(criteria, fuzzyResults);
        suggestions.push(...validatedFuzzyResults);
        
        if (validatedFuzzyResults.length > 0) {
          warnings.push('No se encontró la vía exacta, se muestran resultados con validación cruzada');
        }
      }

      // ESTRATEGIA 3: Búsqueda geográfica como último recurso
      if (criteria.coordinates && this.config.enableGeographicSearch && suggestions.length === 0) {
        const geoResults = await this.addressRepository.searchByGeographicProximity(
          criteria.coordinates.latitude,
          criteria.coordinates.longitude
        );
        
        // Validación muy estricta para resultados geográficos
        const validatedGeoResults = this.validateGeographicResults(criteria, geoResults);
        
        if (validatedGeoResults.length > 0) {
          suggestions.push(...validatedGeoResults);
          warnings.push('Se encontraron direcciones cercanas geográficamente con validación textual');
        }
        
        if (geoResults.length > validatedGeoResults.length) {
          warnings.push(`Se descartaron ${geoResults.length - validatedGeoResults.length} resultados geográficos por baja similitud textual`);
        }
      }

      // Ordenar por confianza ajustada
      suggestions.sort((a, b) => b.confidence - a.confidence);

      if (suggestions.length === 0) {
        errors.push('No se encontraron direcciones que coincidan con el nombre y tipo de vía especificados');
        return {
          isValid: false,
          confidence: 0,
          matchType: 'exact',
          suggestions: [],
          errors,
          warnings
        };
      }

      const bestMatch = suggestions[0];
      const isValid = bestMatch.confidence >= 0.6; // Umbral más permisivo para correcciones automáticas
      
      if (!isValid) {
        warnings.push('Las coincidencias encontradas tienen baja confianza');
      }

      return {
        isValid,
        confidence: bestMatch.confidence,
        matchType: bestMatch.matchType,
        suggestions: suggestions.slice(0, this.config.maxResults),
        errors,
        warnings
      };

    } catch (error) {
      console.error('Error en búsqueda de direcciones:', error);
      errors.push(`Error en la búsqueda: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      
      return {
        isValid: false,
        confidence: 0,
        matchType: 'exact',
        suggestions: [],
        errors,
        warnings
      };
    }
  }

  /**
   * Validación detallada comparando entrada con datos oficiales
   */
  private async performDetailedValidation(
    input: AddressSearchCriteria,
    officialResults: AddressSearchResult[]
  ): Promise<AddressValidationDetails> {
    
    const bestMatch = officialResults.length > 0 ? officialResults[0] : null;

    const validation: AddressValidationDetails = {
      streetName: {
        input: input.streetName,
        needsCorrection: false,
        similarity: 0
      },
      streetType: {
        input: input.streetType || '',
        needsCorrection: false
      },
      streetNumber: {
        input: input.streetNumber,
        needsCorrection: false,
        inValidRange: false
      },
      postalCode: {
        input: input.postalCode || '',
        needsCorrection: false
      },
      district: {
        input: input.district || '',
        needsCorrection: false
      },
      coordinates: {
        input: input.coordinates,
        needsReview: false
      }
    };

    if (!bestMatch) {
      // Sin datos oficiales para comparar
      validation.streetName.similarity = 0;
      validation.streetName.needsCorrection = true;
      validation.streetType.needsCorrection = true;
      validation.streetNumber.needsCorrection = true;
      validation.postalCode.needsCorrection = true;
      validation.district.needsCorrection = true;
      validation.coordinates.needsReview = true;
      return validation;
    }

    // Validar nombre de vía
    validation.streetName.official = bestMatch.nombreViaAcentos;
    validation.streetName.similarity = this.calculateStringSimilarity(
      input.streetName,
      bestMatch.nombreViaAcentos
    );
    validation.streetName.needsCorrection = validation.streetName.similarity < 0.9;

    // Validar tipo de vía
    validation.streetType.official = bestMatch.claseVia;
    validation.streetType.needsCorrection = input.streetType ? 
      !this.areStreetTypesEquivalent(input.streetType, bestMatch.claseVia) : false;

    // Validar número
    if (input.streetNumber && bestMatch.numero) {
      validation.streetNumber.official = bestMatch.numero;
      validation.streetNumber.needsCorrection = parseInt(input.streetNumber) !== bestMatch.numero;
      validation.streetNumber.inValidRange = await this.isNumberInValidRange();
    } else if (input.streetNumber && !bestMatch.numero) {
      validation.streetNumber.needsCorrection = true;
      validation.streetNumber.inValidRange = false;
    }

    // Validar código postal
    if (input.postalCode && bestMatch.codigoPostal) {
      validation.postalCode.official = bestMatch.codigoPostal;
      validation.postalCode.needsCorrection = input.postalCode !== bestMatch.codigoPostal;
    }

    // Validar distrito
    const inputDistrictNumber = typeof input.district === 'number' ? 
      input.district : this.extractDistrictNumber(input.district?.toString() || '');
    
    validation.district.official = bestMatch.distrito;
    validation.district.needsCorrection = inputDistrictNumber !== bestMatch.distrito;

    // Validar coordenadas
    if (input.coordinates) {
      validation.coordinates.official = {
        latitude: bestMatch.latitud,
        longitude: bestMatch.longitud
      };
      
      const distance = this.calculateDistance(
        input.coordinates.latitude,
        input.coordinates.longitude,
        bestMatch.latitud,
        bestMatch.longitud
      );
      
      validation.coordinates.distance = distance * 1000; // Convertir a metros
      validation.coordinates.needsReview = distance * 1000 > this.config.coordinateToleranceMeters;
    }

    return validation;
  }

  /**
   * Determina el estado general de la validación
   */
  private determineOverallStatus(
    searchResult: ValidationResult,
    validationDetails: AddressValidationDetails
  ): 'valid' | 'needs_review' | 'invalid' {
    
    if (!searchResult.isValid || searchResult.suggestions.length === 0) {
      return 'invalid';
    }

    const hasCorrections = 
      validationDetails.streetName.needsCorrection ||
      validationDetails.streetType.needsCorrection ||
      validationDetails.streetNumber.needsCorrection ||
      validationDetails.postalCode.needsCorrection ||
      validationDetails.district.needsCorrection ||
      validationDetails.coordinates.needsReview;

    if (hasCorrections) {
      return 'needs_review';
    }

    if (searchResult.confidence >= 0.95 && searchResult.matchType === 'exact') {
      return 'valid';
    }

    return 'needs_review';
  }

  /**
   * Genera acciones recomendadas basadas en la validación
   */
  private generateRecommendedActions(
    searchResult: ValidationResult,
    validationDetails: AddressValidationDetails
  ): string[] {
    const actions: string[] = [];

    if (!searchResult.isValid) {
      actions.push('Verificar la dirección manualmente');
      actions.push('Comprobar si la dirección existe en el callejero oficial');
      return actions;
    }

    if (validationDetails.streetName.needsCorrection && validationDetails.streetName.official) {
      actions.push(`Corregir nombre de vía a: "${validationDetails.streetName.official}"`);
    }

    if (validationDetails.streetType.needsCorrection && validationDetails.streetType.official) {
      actions.push(`Corregir tipo de vía a: "${validationDetails.streetType.official}"`);
    }

    if (validationDetails.streetNumber.needsCorrection && validationDetails.streetNumber.official) {
      actions.push(`Corregir número a: ${validationDetails.streetNumber.official}`);
    }

    if (validationDetails.postalCode.needsCorrection && validationDetails.postalCode.official) {
      actions.push(`Corregir código postal a: ${validationDetails.postalCode.official}`);
    }

    if (validationDetails.district.needsCorrection && validationDetails.district.official) {
      actions.push(`Corregir distrito a: ${validationDetails.district.official}`);
    }

    if (validationDetails.coordinates.needsReview && validationDetails.coordinates.official) {
      const distance = validationDetails.coordinates.distance || 0;
      actions.push(`Revisar coordenadas (distancia: ${Math.round(distance)}m de la dirección oficial)`);
    }

    if (!validationDetails.streetNumber.inValidRange && validationDetails.streetNumber.input) {
      actions.push('Verificar que el número esté en el rango válido para esta vía');
    }

    if (actions.length === 0) {
      actions.push('Dirección validada correctamente');
    }

    return actions;
  }

  /**
   * Verifica si un número está en el rango válido para una vía y distrito
   */
  private async isNumberInValidRange(): Promise<boolean> {
    try {
      // TODO: Implementar verificación de rangos cuando la tabla esté disponible
      // Por ahora, asumir que todos los números son válidos
      return true;
    } catch (error) {
      console.error('Error verificando rango de numeración:', error);
      return true; // En caso de error, asumir válido
    }
  }

  /**
   * Calcula similitud entre dos strings
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const normalized1 = this.normalizeText(str1);
    const normalized2 = this.normalizeText(str2);
    
    if (normalized1 === normalized2) return 1.0;
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Verifica si dos tipos de vía son equivalentes
   */
  private areStreetTypesEquivalent(type1: string, type2: string): boolean {
    const normalized1 = this.normalizeText(type1);
    const normalized2 = this.normalizeText(type2);
    
    if (normalized1 === normalized2) return true;
    
    // Mapeo de tipos equivalentes
    const equivalents: { [key: string]: string[] } = {
      'calle': ['c', 'cl', 'calle'],
      'avenida': ['av', 'avda', 'avenida'],
      'plaza': ['pl', 'plz', 'plaza'],
      'paseo': ['ps', 'pso', 'paseo'],
      'glorieta': ['gta', 'glorieta'],
      'ronda': ['rda', 'ronda']
    };
    
    for (const [, variants] of Object.entries(equivalents)) {
      if (variants.includes(normalized1) && variants.includes(normalized2)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calcula distancia entre dos puntos en kilómetros
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
   * Normaliza texto para comparaciones
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, '') // Quitar puntuación
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normaliza nombres de vía para búsqueda más flexible
   */
  private normalizeStreetName(streetName: string): string {
    let normalized = this.normalizeText(streetName);
    
    // Remover artículos y preposiciones comunes al inicio
    const articlesAndPrepositions = [
      'de la', 'del', 'de los', 'de las', 'de',
      'la', 'el', 'los', 'las',
      'san', 'santa', 'santo'
    ];
    
    for (const article of articlesAndPrepositions) {
      if (normalized.startsWith(article + ' ')) {
        normalized = normalized.substring(article.length + 1);
        break;
      }
    }
    
    return normalized.trim();
  }

  /**
   * Extrae número de distrito de un string
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
   * Calcula distancia de Levenshtein
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
   * Valida referencias cruzadas para resultados fuzzy
   */
  private validateCrossReferences(
    criteria: AddressSearchCriteria,
    results: AddressSearchResult[]
  ): AddressSearchResult[] {
    return results.filter(result => {
      const score = result.confidence;
      let penalties = 0;

      // Penalizar si el código postal no coincide
      if (criteria.postalCode && result.codigoPostal && criteria.postalCode !== result.codigoPostal) {
        penalties += 0.3;
      }

      // Penalizar si el distrito no coincide
      if (criteria.district) {
        const inputDistrict = typeof criteria.district === 'number' ? 
          criteria.district : this.extractDistrictNumber(criteria.district.toString());
        if (inputDistrict > 0 && inputDistrict !== result.distrito) {
          penalties += 0.3;
        }
      }

      // Penalizar si el tipo de vía no coincide
      if (criteria.streetType && !this.areStreetTypesEquivalent(criteria.streetType, result.claseVia)) {
        penalties += 0.2;
      }

      // Aplicar penalizaciones
      const adjustedScore = Math.max(0, score - penalties);
      
      // Solo mantener resultados con score ajustado >= 0.4
      if (adjustedScore >= 0.4) {
        result.confidence = adjustedScore;
        return true;
      }
      
      return false;
    });
  }

  /**
   * Valida resultados geográficos con similitud textual
   */
  private validateGeographicResults(
    criteria: AddressSearchCriteria,
    results: AddressSearchResult[]
  ): AddressSearchResult[] {
    return results.filter(result => {
      // Calcular similitud textual mínima
      const streetSimilarity = this.calculateStringSimilarity(
        criteria.streetName,
        result.nombreViaAcentos
      );

      // Verificar si hay alguna similitud textual razonable
      const hasTextualSimilarity = streetSimilarity >= 0.3;

      // Verificar coherencia de código postal y distrito
      let hasCoherence = true;
      
      if (criteria.postalCode && result.codigoPostal) {
        hasCoherence = hasCoherence && (criteria.postalCode === result.codigoPostal);
      }

      if (criteria.district) {
        const inputDistrict = typeof criteria.district === 'number' ? 
          criteria.district : this.extractDistrictNumber(criteria.district.toString());
        if (inputDistrict > 0) {
          hasCoherence = hasCoherence && (inputDistrict === result.distrito);
        }
      }

      // Solo aceptar si hay similitud textual O coherencia completa
      const isValid = hasTextualSimilarity || hasCoherence;

      if (isValid) {
        // Ajustar confianza basándose en similitud textual
        const textualBonus = streetSimilarity * 0.5;
        const coherenceBonus = hasCoherence ? 0.3 : 0;
        result.confidence = Math.min(1.0, result.confidence + textualBonus + coherenceBonus);
      }

      return isValid;
    });
  }

  /**
   * Corrige automáticamente campos basándose en la vía encontrada
   */
  private correctAddressFields(
    originalCriteria: AddressSearchCriteria,
    foundResults: AddressSearchResult[]
  ): AddressSearchResult[] {
    const requestedNumber = originalCriteria.streetNumber ? parseInt(originalCriteria.streetNumber) : null;
    
    // Primero ordenar por proximidad al número solicitado si hay número
    if (requestedNumber) {
      foundResults.sort((a, b) => {
        const distanceA = a.numero ? Math.abs(a.numero - requestedNumber) : 999;
        const distanceB = b.numero ? Math.abs(b.numero - requestedNumber) : 999;
        return distanceA - distanceB;
      });
    }
    
    return foundResults.map((result, index) => {
      // Crear una copia del resultado para modificar
      const correctedResult = { ...result };
      
      // Calcular confianza base
      let confidence = result.confidence;
      
      // PENALIZACIÓN POR DISCREPANCIA DE NÚMEROS
      if (requestedNumber && result.numero && requestedNumber !== result.numero) {
        const difference = Math.abs(requestedNumber - result.numero);
        // Penalización progresiva: 5% por cada número de diferencia, máximo 40%
        const penalty = Math.min(0.4, difference * 0.05);
        confidence = Math.max(0.1, confidence - penalty);
      }
      
      // DIFERENCIACIÓN POR POSICIÓN EN RESULTADOS
      if (index > 0) {
        // Reducir confianza por posición: 3% menos por cada posición después de la primera
        const positionPenalty = index * 0.03;
        confidence = Math.max(0.1, confidence - positionPenalty);
      }
      
      // BONIFICACIÓN POR COINCIDENCIA EXACTA DE NÚMERO
      if (requestedNumber && result.numero && requestedNumber === result.numero) {
        confidence = Math.min(1.0, confidence + 0.1); // 10% bonus por número exacto
      }
      
      // Aumentar confianza base si encontramos la vía correcta (pero menos que antes)
      confidence = Math.min(1.0, confidence + 0.1);
      
      correctedResult.confidence = confidence;
      
      return correctedResult;
    });
  }

  /**
   * Genera warnings sobre correcciones automáticas
   */
  private generateCorrectionWarnings(
    originalCriteria: AddressSearchCriteria,
    correctedResult: AddressSearchResult
  ): string[] {
    const warnings: string[] = [];
    
    // WARNING ESPECÍFICO PARA NÚMEROS DE CALLE
    if (originalCriteria.streetNumber && correctedResult.numero) {
      const requestedNumber = parseInt(originalCriteria.streetNumber);
      if (!isNaN(requestedNumber) && requestedNumber !== correctedResult.numero) {
        const difference = Math.abs(requestedNumber - correctedResult.numero);
        if (difference === 1 || difference === 2) {
          warnings.push(`Número de calle cercano encontrado: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
        } else if (difference <= 10) {
          warnings.push(`Número de calle diferente: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
        } else {
          warnings.push(`Número de calle muy diferente: solicitado ${requestedNumber}, encontrado ${correctedResult.numero} (diferencia: ${difference})`);
        }
      }
    } else if (originalCriteria.streetNumber && !correctedResult.numero) {
      warnings.push(`Número de calle solicitado (${originalCriteria.streetNumber}) no encontrado en la dirección oficial`);
    }
    
    if (originalCriteria.postalCode && correctedResult.codigoPostal && 
        originalCriteria.postalCode !== correctedResult.codigoPostal) {
      warnings.push(`Código postal corregido automáticamente: ${originalCriteria.postalCode} → ${correctedResult.codigoPostal}`);
    }
    
    if (originalCriteria.district) {
      const inputDistrict = typeof originalCriteria.district === 'number' ? 
        originalCriteria.district : this.extractDistrictNumber(originalCriteria.district.toString());
      if (inputDistrict > 0 && inputDistrict !== correctedResult.distrito) {
        warnings.push(`Distrito corregido automáticamente: ${originalCriteria.district} → ${correctedResult.distrito}`);
      }
    }
    
    if (originalCriteria.coordinates && correctedResult.latitud && correctedResult.longitud) {
      const distance = this.calculateDistance(
        originalCriteria.coordinates.latitude,
        originalCriteria.coordinates.longitude,
        correctedResult.latitud,
        correctedResult.longitud
      ) * 1000;
      
      if (distance > 100) {
        warnings.push(`Coordenadas corregidas automáticamente (diferencia: ${Math.round(distance)}m)`);
      }
    }
    
    return warnings;
  }

  /**
   * Validación más permisiva para resultados basados en vía
   */
  private validateStreetBasedResults(
    criteria: AddressSearchCriteria,
    results: AddressSearchResult[]
  ): AddressSearchResult[] {
    return results.filter(result => {
      // Para resultados basados en vía, ser más permisivo
      const streetSimilarity = this.calculateStreetNameSimilarity(
        criteria.streetName,
        result.nombreViaAcentos
      );
      
      // Umbral más bajo para similitud de vía
      const hasGoodStreetMatch = streetSimilarity >= 0.5;
      
      // Verificar tipo de vía si está disponible
      let hasGoodTypeMatch = true;
      if (criteria.streetType) {
        hasGoodTypeMatch = this.areStreetTypesEquivalent(criteria.streetType, result.claseVia);
      }
      
      return hasGoodStreetMatch && hasGoodTypeMatch;
    });
  }

  /**
   * Calcula similitud entre nombres de vía con normalización especial
   */
  private calculateStreetNameSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    // Usar normalización especial para nombres de vía
    const normalized1 = this.normalizeStreetName(str1);
    const normalized2 = this.normalizeStreetName(str2);
    
    if (normalized1 === normalized2) return 1.0;
    
    // También probar similitud con normalización básica
    const basicSimilarity = this.calculateStringSimilarity(str1, str2);
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const normalizedSimilarity = Math.max(0, 1 - (distance / maxLength));
    
    // Devolver la mejor similitud
    return Math.max(basicSimilarity, normalizedSimilarity);
  }
}

export const newMadridValidationService = new NewMadridValidationService();
