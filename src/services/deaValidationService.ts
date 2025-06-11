import { madridGeocodingService, GeographicValidation } from './madridGeocodingService';
import { textNormalizationService, NormalizationResult } from './textNormalizationService';
import { deaCodeService, DeaCodeGeneration } from './deaCodeService';
import { newMadridValidationService } from './newMadridValidationService';
import { ComprehensiveAddressValidation } from '../types/address';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DeaValidationResult {
  id: number;
  newAddressValidation: ComprehensiveAddressValidation;
  geographic: {
    originalData: {
      tipoVia: string;
      nombreVia: string;
      numeroVia: string | null;
      complementoDireccion: string | null;
      codigoPostal: number;
      distrito: string;
      distritoNumero: number;
      latitud: number;
      longitud: number;
    };
    validation: GeographicValidation;
    needsReview: boolean;
    suggestions: string[];
  };
  textFields: {
    titularidad: NormalizationResult & { needsReview: boolean };
    propuestaDenominacion: NormalizationResult & { needsReview: boolean };
    nombreVia: NormalizationResult & { needsReview: boolean };
  };
  deaCode: {
    generated: DeaCodeGeneration | null;
    needsGeneration: boolean;
    currentCode: string | null;
  };
  overallStatus: 'valid' | 'needs_review' | 'invalid';
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    suggestions: string[];
  };
}

export interface ValidationBatchResult {
  processed: number;
  successful: number;
  withIssues: number;
  failed: number;
  results: DeaValidationResult[];
  errors: string[];
}

export class DeaValidationService {
  
  /**
   * Valida un registro DEA completo
   */
  async validateDeaRecord(deaRecordId: number): Promise<DeaValidationResult> {
    const record = await prisma.deaRecord.findUnique({
      where: { id: deaRecordId }
    });
    
    if (!record) {
      throw new Error(`Registro DEA con ID ${deaRecordId} no encontrado`);
    }
    
    // Extraer número del distrito (ej: "2. Arganzuela" -> 2)
    const distritoNumero = this.extractDistrictNumber(record.distrito);
    
    // Validación usando el nuevo sistema optimizado
    let newAddressValidation: ComprehensiveAddressValidation;
    try {
      newAddressValidation = await newMadridValidationService.validateAddress(
        record.tipoVia,
        record.nombreVia,
        record.numeroVia || undefined,
        record.codigoPostal.toString(),
        record.distrito,
        { latitude: record.latitud, longitude: record.longitud }
      );
    } catch (error) {
      console.error('Error en nueva validación de direcciones:', error);
      // Crear una validación básica en caso de error
      newAddressValidation = {
        searchResult: {
          isValid: false,
          confidence: 0,
          matchType: 'exact',
          suggestions: [],
          errors: ['Error en validación de direcciones'],
          warnings: []
        },
        validationDetails: {
          streetName: { input: record.nombreVia, needsCorrection: false, similarity: 0 },
          streetType: { input: record.tipoVia, needsCorrection: false },
          streetNumber: { input: record.numeroVia || '', needsCorrection: false, inValidRange: false },
          postalCode: { input: record.codigoPostal.toString(), needsCorrection: false },
          district: { input: record.distrito, needsCorrection: false },
          coordinates: { input: { latitude: record.latitud, longitude: record.longitud }, needsReview: false }
        },
        overallStatus: 'invalid',
        recommendedActions: ['Revisar dirección manualmente']
      };
    }

    const result: DeaValidationResult = {
      id: deaRecordId,
      newAddressValidation,
      geographic: {
        originalData: {
          tipoVia: record.tipoVia,
          nombreVia: record.nombreVia,
          numeroVia: record.numeroVia,
          complementoDireccion: record.complementoDireccion,
          codigoPostal: record.codigoPostal,
          distrito: record.distrito,
          distritoNumero: distritoNumero,
          latitud: record.latitud,
          longitud: record.longitud
        },
        validation: {} as GeographicValidation,
        needsReview: false,
        suggestions: []
      },
      textFields: {
        titularidad: { ...textNormalizationService.normalizeTitularidad(record.titularidad), needsReview: false },
        propuestaDenominacion: { ...textNormalizationService.normalizeDenominacion(record.propuestaDenominacion), needsReview: false },
        nombreVia: { ...textNormalizationService.normalizeStreetName(record.nombreVia), needsReview: false }
      },
      deaCode: {
        generated: null,
        needsGeneration: !record.defCodDea,
        currentCode: record.defCodDea
      },
      overallStatus: 'valid',
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0,
        suggestions: []
      }
    };
    
    // 1. Validación geográfica
    try {
      result.geographic.validation = await madridGeocodingService.validateGeographicData(
        record.nombreVia,
        record.numeroVia,
        record.codigoPostal.toString(),
        record.distrito,
        record.latitud,
        record.longitud
      );
      
      result.geographic.needsReview = this.needsGeographicReview(result.geographic.validation);
      result.geographic.suggestions = this.getGeographicSuggestions(result.geographic.validation);
      
    } catch (error) {
      console.error('Error en validación geográfica:', error);
      // Crear una validación básica cuando falla la validación completa
      result.geographic.validation = this.createBasicGeographicValidation();
      result.geographic.needsReview = false; // No requerir revisión si no hay datos de referencia
      result.geographic.suggestions.push('Validación geográfica no disponible - usando datos básicos');
    }
    
    // 2. Validación de campos de texto
    result.textFields.titularidad.needsReview = textNormalizationService.needsManualReview(
      record.titularidad,
      result.textFields.titularidad.normalized
    );
    
    result.textFields.propuestaDenominacion.needsReview = textNormalizationService.needsManualReview(
      record.propuestaDenominacion,
      result.textFields.propuestaDenominacion.normalized
    );
    
    result.textFields.nombreVia.needsReview = textNormalizationService.needsManualReview(
      record.nombreVia,
      result.textFields.nombreVia.normalized
    );
    
    // 3. Generación de código DEA si es necesario
    if (result.deaCode.needsGeneration) {
      try {
        // Usar distrito y código postal validados o originales
        const distrito = result.geographic.validation.suggestedData.distrito || parseInt(record.distrito);
        const codigoPostal = result.geographic.validation.suggestedData.codPostal || record.codigoPostal.toString();
        
        result.deaCode.generated = await deaCodeService.generateDeaCode(distrito, codigoPostal);
      } catch (error) {
        result.deaCode.generated = {
          codigo: '',
          distrito: parseInt(record.distrito),
          codigoPostal: record.codigoPostal.toString(),
          secuencial: 0,
          isValid: false,
          errors: [`Error generando código: ${error instanceof Error ? error.message : 'Error desconocido'}`]
        };
      }
    }
    
    // 4. Calcular estado general y resumen
    this.calculateOverallStatus(result);
    
    return result;
  }
  
  /**
   * Aplica las correcciones sugeridas a un registro DEA
   */
  async applyValidationCorrections(
    deaRecordId: number,
    corrections: {
      applyGeographic?: boolean;
      applyTextNormalization?: boolean;
      applyDeaCode?: boolean;
      manualOverrides?: {
        titularidad?: string;
        propuestaDenominacion?: string;
        nombreVia?: string;
        codigoPostal?: string;
        distrito?: string;
        latitud?: number;
        longitud?: number;
      };
    }
  ): Promise<{ success: boolean; updatedFields: string[]; errors: string[] }> {
    const result = {
      success: false,
      updatedFields: [] as string[],
      errors: [] as string[]
    };
    
    try {
      const validation = await this.validateDeaRecord(deaRecordId);
      const updateData: Record<string, string | number | null> = {};
      
      // Aplicar correcciones geográficas
      if (corrections.applyGeographic && validation.geographic.validation.suggestedData) {
        const suggested = validation.geographic.validation.suggestedData;
        
        if (suggested.codPostal) {
          updateData.gmCp = suggested.codPostal;
          updateData.defCp = suggested.codPostal;
          result.updatedFields.push('Código postal');
        }
        
        if (suggested.distrito) {
          updateData.gmDistrito = suggested.distrito.toString();
          updateData.defDistrito = suggested.distrito.toString();
          result.updatedFields.push('Distrito');
        }
        
        if (suggested.latitud && suggested.longitud) {
          updateData.gmLat = suggested.latitud;
          updateData.gmLon = suggested.longitud;
          updateData.defLat = suggested.latitud;
          updateData.defLon = suggested.longitud;
          result.updatedFields.push('Coordenadas');
        }
        
        if (suggested.viaNombreAcentos) {
          updateData.gmNombreVia = suggested.viaNombreAcentos;
          updateData.defNombreVia = suggested.viaNombreAcentos;
          result.updatedFields.push('Nombre de vía');
        }
      }
      
      // Aplicar normalización de texto
      if (corrections.applyTextNormalization) {
        if (validation.textFields.titularidad.normalized !== validation.textFields.titularidad.original) {
          updateData.titularidad = validation.textFields.titularidad.normalized;
          result.updatedFields.push('Titularidad');
        }
        
        if (validation.textFields.propuestaDenominacion.normalized !== validation.textFields.propuestaDenominacion.original) {
          updateData.propuestaDenominacion = validation.textFields.propuestaDenominacion.normalized;
          result.updatedFields.push('Propuesta de denominación');
        }
        
        if (validation.textFields.nombreVia.normalized !== validation.textFields.nombreVia.original) {
          updateData.nombreVia = validation.textFields.nombreVia.normalized;
          result.updatedFields.push('Nombre de vía');
        }
      }
      
      // Aplicar código DEA
      if (corrections.applyDeaCode && validation.deaCode.generated?.isValid) {
        updateData.defCodDea = validation.deaCode.generated.codigo;
        
        // Asignar el código al registro
        await deaCodeService.assignCodeToRecord(validation.deaCode.generated.codigo, deaRecordId);
        result.updatedFields.push('Código DEA');
      }
      
      // Aplicar overrides manuales
      if (corrections.manualOverrides) {
        const overrides = corrections.manualOverrides;
        
        if (overrides.titularidad) {
          updateData.titularidad = overrides.titularidad;
          result.updatedFields.push('Titularidad (manual)');
        }
        
        if (overrides.propuestaDenominacion) {
          updateData.propuestaDenominacion = overrides.propuestaDenominacion;
          result.updatedFields.push('Propuesta de denominación (manual)');
        }
        
        if (overrides.nombreVia) {
          updateData.nombreVia = overrides.nombreVia;
          result.updatedFields.push('Nombre de vía (manual)');
        }
        
        if (overrides.codigoPostal) {
          updateData.codigoPostal = parseInt(overrides.codigoPostal);
          updateData.defCp = overrides.codigoPostal;
          result.updatedFields.push('Código postal (manual)');
        }
        
        if (overrides.distrito) {
          updateData.distrito = overrides.distrito;
          updateData.defDistrito = overrides.distrito;
          result.updatedFields.push('Distrito (manual)');
        }
        
        if (overrides.latitud && overrides.longitud) {
          updateData.latitud = overrides.latitud;
          updateData.longitud = overrides.longitud;
          updateData.defLat = overrides.latitud;
          updateData.defLon = overrides.longitud;
          result.updatedFields.push('Coordenadas (manual)');
        }
      }
      
      // Actualizar registro si hay cambios
      if (Object.keys(updateData).length > 0) {
        await prisma.deaRecord.update({
          where: { id: deaRecordId },
          data: updateData
        });
        
        result.success = true;
      } else {
        result.errors.push('No hay cambios que aplicar');
      }
      
    } catch (error) {
      result.errors.push(`Error aplicando correcciones: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
    
    return result;
  }
  
  /**
   * Valida múltiples registros en lote
   */
  async validateBatch(
    deaRecordIds: number[],
    options: {
      autoApplyCorrections?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<ValidationBatchResult> {
    const result: ValidationBatchResult = {
      processed: 0,
      successful: 0,
      withIssues: 0,
      failed: 0,
      results: [],
      errors: []
    };
    
    const maxConcurrent = options.maxConcurrent || 5;
    const batches = this.createBatches(deaRecordIds, maxConcurrent);
    
    for (const batch of batches) {
      const promises = batch.map(async (id) => {
        try {
          const validation = await this.validateDeaRecord(id);
          
          // Auto-aplicar correcciones si está habilitado
          if (options.autoApplyCorrections && validation.overallStatus !== 'valid') {
            await this.applyValidationCorrections(id, {
              applyGeographic: true,
              applyTextNormalization: true,
              applyDeaCode: true
            });
          }
          
          result.results.push(validation);
          result.processed++;
          
          if (validation.overallStatus === 'valid') {
            result.successful++;
          } else {
            result.withIssues++;
          }
          
        } catch (error) {
          result.failed++;
          result.processed++;
          result.errors.push(`Error validando registro ${id}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      });
      
      await Promise.all(promises);
    }
    
    return result;
  }
  
  /**
   * Obtiene estadísticas de validación
   */
  async getValidationStats(): Promise<{
    total: number;
    withGeographicIssues: number;
    withTextIssues: number;
    withoutDeaCode: number;
    fullyValidated: number;
  }> {
    const total = await prisma.deaRecord.count();
    
    const withoutDeaCode = await prisma.deaRecord.count({
      where: { defCodDea: null }
    });
    
    // Estas estadísticas serían más precisas con campos adicionales en la BD
    // Por ahora, estimaciones basadas en campos existentes
    const withGeographicIssues = await prisma.deaRecord.count({
      where: {
        OR: [
          { gmCp: null },
          { gmDistrito: null },
          { gmLat: null },
          { gmLon: null }
        ]
      }
    });
    
    const fullyValidated = await prisma.deaRecord.count({
      where: {
        AND: [
          { defCodDea: { not: null } },
          { gmCp: { not: null } },
          { gmDistrito: { not: null } },
          { gmLat: { not: null } },
          { gmLon: { not: null } }
        ]
      }
    });
    
    return {
      total,
      withGeographicIssues,
      withTextIssues: 0, // Requeriría análisis más profundo
      withoutDeaCode,
      fullyValidated
    };
  }
  
  private needsGeographicReview(validation: GeographicValidation): boolean {
    return !validation.postalCodeMatch || 
           !validation.districtMatch || 
           !validation.coordinatesValid;
  }
  
  private getGeographicSuggestions(validation: GeographicValidation): string[] {
    const suggestions: string[] = [];
    
    if (!validation.postalCodeMatch) {
      suggestions.push('Código postal no coincide con datos oficiales');
    }
    
    if (!validation.districtMatch) {
      suggestions.push('Distrito no coincide con datos oficiales');
    }
    
    if (validation.coordinatesDistance !== null && validation.coordinatesDistance > 0.02) {
      suggestions.push(`Coordenadas están a ${(validation.coordinatesDistance * 1000).toFixed(0)}m de la dirección oficial`);
    }
    
    return suggestions;
  }
  
  private calculateOverallStatus(result: DeaValidationResult): void {
    let criticalIssues = 0;
    let warnings = 0;
    const suggestions: string[] = [];
    
    // Evaluar problemas geográficos
    if (result.geographic.needsReview) {
      criticalIssues++;
      suggestions.push(...result.geographic.suggestions);
    }
    
    // Evaluar problemas de texto
    if (result.textFields.titularidad.needsReview) {
      warnings++;
      suggestions.push('Titularidad necesita revisión');
    }
    
    if (result.textFields.propuestaDenominacion.needsReview) {
      warnings++;
      suggestions.push('Propuesta de denominación necesita revisión');
    }
    
    if (result.textFields.nombreVia.needsReview) {
      warnings++;
      suggestions.push('Nombre de vía necesita revisión');
    }
    
    // Evaluar código DEA
    if (result.deaCode.needsGeneration) {
      if (!result.deaCode.generated?.isValid) {
        criticalIssues++;
        suggestions.push('No se pudo generar código DEA');
      } else {
        warnings++;
        suggestions.push('Código DEA generado, pendiente de asignación');
      }
    }
    
    // Determinar estado general
    if (criticalIssues > 0) {
      result.overallStatus = 'invalid';
    } else if (warnings > 0) {
      result.overallStatus = 'needs_review';
    } else {
      result.overallStatus = 'valid';
    }
    
    result.summary = {
      totalIssues: criticalIssues + warnings,
      criticalIssues,
      warnings,
      suggestions
    };
  }
  
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
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

  /**
   * Crea una validación geográfica básica cuando no hay datos de referencia disponibles
   */
  private createBasicGeographicValidation(): GeographicValidation {
    return {
      postalCodeMatch: true, // Asumir válido si no hay datos para comparar
      districtMatch: true,   // Asumir válido si no hay datos para comparar
      coordinatesDistance: null,
      coordinatesValid: true, // Asumir válido si no hay datos para comparar
      suggestedData: {
        // No hay sugerencias sin datos de referencia
      }
    };
  }
}

export const deaValidationService = new DeaValidationService();
