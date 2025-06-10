export interface NormalizationResult {
  original: string;
  normalized: string;
  changes: string[];
}

export class TextNormalizationService {
  
  /**
   * Normaliza un texto aplicando todas las reglas de limpieza
   */
  normalizeText(text: string): NormalizationResult {
    const original = text;
    const changes: string[] = [];
    let normalized = text;
    
    if (!text || typeof text !== 'string') {
      return { original, normalized: '', changes: ['Texto vacío o inválido'] };
    }
    
    // 1. Limpiar espacios
    const cleanedSpaces = this.cleanSpaces(normalized);
    if (cleanedSpaces !== normalized) {
      changes.push('Espacios limpiados');
      normalized = cleanedSpaces;
    }
    
    // 2. Capitalización correcta
    const capitalized = this.properCapitalization(normalized);
    if (capitalized !== normalized) {
      changes.push('Capitalización corregida');
      normalized = capitalized;
    }
    
    // 3. Correcciones específicas
    const corrected = this.applySpecificCorrections(normalized);
    if (corrected !== normalized) {
      changes.push('Correcciones específicas aplicadas');
      normalized = corrected;
    }
    
    return { original, normalized, changes };
  }
  
  /**
   * Normaliza específicamente nombres de vías
   */
  normalizeStreetName(streetName: string): NormalizationResult {
    const original = streetName;
    const changes: string[] = [];
    let normalized = streetName;
    
    if (!streetName || typeof streetName !== 'string') {
      return { original, normalized: '', changes: ['Nombre de vía vacío o inválido'] };
    }
    
    // Aplicar normalización básica
    const basicNormalization = this.normalizeText(normalized);
    normalized = basicNormalization.normalized;
    changes.push(...basicNormalization.changes);
    
    // Correcciones específicas para nombres de vías
    const streetSpecific = this.applyStreetSpecificCorrections(normalized);
    if (streetSpecific !== normalized) {
      changes.push('Correcciones específicas de vías aplicadas');
      normalized = streetSpecific;
    }
    
    return { original, normalized, changes };
  }
  
  /**
   * Normaliza titularidad
   */
  normalizeTitularidad(titularidad: string): NormalizationResult {
    const original = titularidad;
    const changes: string[] = [];
    let normalized = titularidad;
    
    if (!titularidad || typeof titularidad !== 'string') {
      return { original, normalized: '', changes: ['Titularidad vacía o inválida'] };
    }
    
    // Aplicar normalización básica
    const basicNormalization = this.normalizeText(normalized);
    normalized = basicNormalization.normalized;
    changes.push(...basicNormalization.changes);
    
    // Correcciones específicas para titularidad
    const titularidadSpecific = this.applyTitularidadCorrections(normalized);
    if (titularidadSpecific !== normalized) {
      changes.push('Correcciones específicas de titularidad aplicadas');
      normalized = titularidadSpecific;
    }
    
    return { original, normalized, changes };
  }
  
  /**
   * Normaliza denominación propuesta
   */
  normalizeDenominacion(denominacion: string): NormalizationResult {
    const original = denominacion;
    const changes: string[] = [];
    let normalized = denominacion;
    
    if (!denominacion || typeof denominacion !== 'string') {
      return { original, normalized: '', changes: ['Denominación vacía o inválida'] };
    }
    
    // Aplicar normalización básica
    const basicNormalization = this.normalizeText(normalized);
    normalized = basicNormalization.normalized;
    changes.push(...basicNormalization.changes);
    
    // Correcciones específicas para denominaciones
    const denominacionSpecific = this.applyDenominacionCorrections(normalized);
    if (denominacionSpecific !== normalized) {
      changes.push('Correcciones específicas de denominación aplicadas');
      normalized = denominacionSpecific;
    }
    
    return { original, normalized, changes };
  }
  
  /**
   * Limpia espacios extra, iniciales y finales
   */
  private cleanSpaces(text: string): string {
    return text
      .trim() // Eliminar espacios al inicio y final
      .replace(/\s+/g, ' '); // Reemplazar múltiples espacios por uno solo
  }
  
  /**
   * Aplica capitalización correcta
   */
  private properCapitalization(text: string): string {
    // Palabras que deben ir en minúsculas (excepto al inicio)
    const lowercaseWords = [
      'de', 'del', 'de la', 'de las', 'de los',
      'y', 'e', 'o', 'u',
      'en', 'con', 'por', 'para', 'sin',
      'el', 'la', 'los', 'las',
      'un', 'una', 'unos', 'unas',
      'al', 'a la', 'a los', 'a las'
    ];
    
    // Palabras que siempre van en mayúsculas
    const uppercaseWords = [
      'S.A.', 'S.L.', 'S.L.U.', 'S.A.U.',
      'C.B.', 'S.C.', 'A.I.E.',
      'CEIP', 'IES', 'CEO', 'CRA',
      'ONCE', 'RENFE', 'EMT',
      'UE', 'EU', 'EE.UU.',
      'DNI', 'NIE', 'NIF'
    ];
    
    const words = text.toLowerCase().split(' ');
    
    return words.map((word, index) => {
      // Primera palabra siempre capitalizada
      if (index === 0) {
        return this.capitalizeFirstLetter(word);
      }
      
      // Palabras que van en mayúsculas
      const upperMatch = uppercaseWords.find(uw => 
        uw.toLowerCase() === word.toLowerCase()
      );
      if (upperMatch) {
        return upperMatch;
      }
      
      // Palabras que van en minúsculas
      if (lowercaseWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      
      // Resto de palabras capitalizadas
      return this.capitalizeFirstLetter(word);
    }).join(' ');
  }
  
  /**
   * Capitaliza la primera letra de una palabra
   */
  private capitalizeFirstLetter(word: string): string {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  
  /**
   * Aplica correcciones específicas generales
   */
  private applySpecificCorrections(text: string): string {
    let corrected = text;
    
    // Correcciones comunes
    const corrections: { [key: string]: string } = {
      'AYUNTAMIENTO': 'Ayuntamiento',
      'COMUNIDAD': 'Comunidad',
      'MADRID': 'Madrid',
      'ESPAÑA': 'España',
      'CENTRO': 'Centro',
      'HOSPITAL': 'Hospital',
      'COLEGIO': 'Colegio',
      'INSTITUTO': 'Instituto',
      'UNIVERSIDAD': 'Universidad',
      'FARMACIA': 'Farmacia',
      'SUPERMERCADO': 'Supermercado',
      'MERCADO': 'Mercado',
      'CENTRO COMERCIAL': 'Centro Comercial',
      'ESTACION': 'Estación',
      'ESTACIÓN': 'Estación'
    };
    
    // Aplicar correcciones
    Object.entries(corrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    });
    
    return corrected;
  }
  
  /**
   * Aplica correcciones específicas para nombres de vías
   */
  private applyStreetSpecificCorrections(streetName: string): string {
    let corrected = streetName;
    
    // Eliminar artículos innecesarios al inicio
    const articlesToRemove = [
      /^del\s+/i,
      /^de\s+la\s+/i,
      /^de\s+los\s+/i,
      /^de\s+las\s+/i
    ];
    
    articlesToRemove.forEach(regex => {
      corrected = corrected.replace(regex, '');
    });
    
    // Correcciones específicas de vías
    const streetCorrections: { [key: string]: string } = {
      'AVDA': 'Avenida',
      'AVD': 'Avenida',
      'AV': 'Avenida',
      'C/': 'Calle',
      'CL': 'Calle',
      'PL': 'Plaza',
      'PZ': 'Plaza',
      'PS': 'Paseo',
      'PSO': 'Paseo',
      'GLTA': 'Glorieta',
      'CTRA': 'Carretera',
      'CARR': 'Carretera'
    };
    
    Object.entries(streetCorrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    });
    
    return corrected.trim();
  }
  
  /**
   * Aplica correcciones específicas para titularidad
   */
  private applyTitularidadCorrections(titularidad: string): string {
    let corrected = titularidad;
    
    // Correcciones específicas de entidades
    const entityCorrections: { [key: string]: string } = {
      'AYTO': 'Ayuntamiento',
      'AYTO.': 'Ayuntamiento',
      'COMUNIDAD DE MADRID': 'Comunidad de Madrid',
      'CAM': 'Comunidad de Madrid',
      'SERMAS': 'SERMAS',
      'SERVICIO MADRILEÑO DE SALUD': 'Servicio Madrileño de Salud',
      'CONSEJERIA': 'Consejería',
      'CONSEJERÍA': 'Consejería'
    };
    
    Object.entries(entityCorrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    });
    
    return corrected;
  }
  
  /**
   * Aplica correcciones específicas para denominaciones
   */
  private applyDenominacionCorrections(denominacion: string): string {
    let corrected = denominacion;
    
    // Eliminar redundancias comunes
    const redundancies = [
      /\s*-\s*DEA\s*$/i,
      /\s*-\s*DESFIBRILADOR\s*$/i,
      /\s*\(DEA\)\s*$/i,
      /\s*\(DESFIBRILADOR\)\s*$/i
    ];
    
    redundancies.forEach(regex => {
      corrected = corrected.replace(regex, '');
    });
    
    // Asegurar que sea descriptivo y único
    if (corrected.length < 5) {
      // Si es muy corto, podría necesitar más información
      // Esto se manejaría en la validación manual
    }
    
    return corrected.trim();
  }
  
  /**
   * Valida si un texto necesita revisión manual
   */
  needsManualReview(text: string, normalized: string): boolean {
    // Casos que requieren revisión manual
    const manualReviewCases = [
      // Texto muy corto
      normalized.length < 3,
      // Muchos números
      (normalized.match(/\d/g) || []).length > normalized.length * 0.5,
      // Muchas mayúsculas consecutivas
      /[A-Z]{4,}/.test(normalized),
      // Caracteres especiales sospechosos
      /[^\w\s\-.,áéíóúüñÁÉÍÓÚÜÑ]/.test(normalized),
      // Cambios muy significativos
      Math.abs(text.length - normalized.length) > text.length * 0.3
    ];
    
    return manualReviewCases.some(condition => condition);
  }
  
  /**
   * Obtiene sugerencias de mejora
   */
  getSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    
    if (!text || text.trim().length === 0) {
      suggestions.push('El campo está vacío');
      return suggestions;
    }
    
    if (text.length < 5) {
      suggestions.push('El texto es muy corto, considere añadir más información');
    }
    
    if (text === text.toUpperCase()) {
      suggestions.push('Todo el texto está en mayúsculas');
    }
    
    if (text === text.toLowerCase()) {
      suggestions.push('Todo el texto está en minúsculas');
    }
    
    if (/\s{2,}/.test(text)) {
      suggestions.push('Contiene espacios múltiples');
    }
    
    if (/^\s|\s$/.test(text)) {
      suggestions.push('Contiene espacios al inicio o final');
    }
    
    if (/[^\w\s\-.,áéíóúüñÁÉÍÓÚÜÑ]/.test(text)) {
      suggestions.push('Contiene caracteres especiales que podrían necesitar revisión');
    }
    
    return suggestions;
  }
}

export const textNormalizationService = new TextNormalizationService();
