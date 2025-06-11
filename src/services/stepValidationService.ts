import { PrismaClient } from '@prisma/client';
import { newMadridValidationService } from './newMadridValidationService';
import { verificationRepository } from '@/repositories/verificationRepository';
import { AddressSearchResult } from '@/types/address';
import { DeaRecord } from '@/types/index';

const prisma = new PrismaClient();

export interface ValidationStep {
  stepNumber: 1 | 2 | 3 | 4;
  title: string;
  status: 'pending' | 'current' | 'completed' | 'skipped';
  required: boolean;
  skipReason?: string;
  data?: Record<string, unknown>;
}

export interface StepValidationProgress {
  deaRecordId: number;
  currentStep: number;
  totalSteps: number;
  steps: ValidationStep[];
  stepData: {
    step1?: {
      selectedAddress: AddressSearchResult;
      userConfirmed: boolean;
      timestamp: Date;
    };
    step2?: {
      originalPostalCode: string;
      confirmedPostalCode: string;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step3?: {
      originalDistrict: string;
      confirmedDistrict: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step4?: {
      originalCoordinates: { lat: number; lng: number };
      confirmedCoordinates: { lat: number; lng: number };
      distance: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
  };
  isComplete: boolean;
  completedAt?: Date;
}

export interface StepValidationResult {
  success: boolean;
  progress: StepValidationProgress;
  nextStep?: number;
  message?: string;
  error?: string;
}

export class StepValidationService {
  
  /**
   * Inicia el proceso de validación paso a paso
   */
  async initializeStepValidation(deaRecordId: number): Promise<StepValidationResult> {
    try {
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (!record) {
        return {
          success: false,
          error: 'Registro DEA no encontrado',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      // Crear progreso inicial
      const progress: StepValidationProgress = {
        deaRecordId,
        currentStep: 1,
        totalSteps: 4, // Se ajustará dinámicamente
        steps: [
          {
            stepNumber: 1,
            title: 'Confirmar Dirección',
            status: 'current',
            required: true
          },
          {
            stepNumber: 2,
            title: 'Verificar Código Postal',
            status: 'pending',
            required: true // Se determinará después del paso 1
          },
          {
            stepNumber: 3,
            title: 'Verificar Distrito',
            status: 'pending',
            required: true // Se determinará después del paso 1
          },
          {
            stepNumber: 4,
            title: 'Verificar Coordenadas',
            status: 'pending',
            required: true // Se determinará después del paso 1
          }
        ],
        stepData: {},
        isComplete: false
      };
      
      return {
        success: true,
        progress,
        nextStep: 1,
        message: 'Validación iniciada. Confirme la dirección encontrada.'
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error iniciando validación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        progress: this.createEmptyProgress(deaRecordId)
      };
    }
  }
  
  /**
   * Ejecuta el Paso 1: Búsqueda y confirmación de dirección
   */
  async executeStep1(
    deaRecordId: number,
    selectedAddress?: AddressSearchResult
  ): Promise<StepValidationResult> {
    try {
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (!record) {
        return {
          success: false,
          error: 'Registro DEA no encontrado',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      let officialAddress: AddressSearchResult | null = selectedAddress || null;
      
      // Si no se proporciona dirección, buscar automáticamente
      if (!officialAddress) {
        const validationResult = await newMadridValidationService.validateAddress(
          record.tipoVia,
          record.nombreVia,
          record.numeroVia || undefined,
          record.codigoPostal.toString(),
          record.distrito,
          { latitude: record.latitud, longitude: record.longitud }
        );
        
        if (validationResult.searchResult.isValid && validationResult.searchResult.suggestions.length > 0) {
          officialAddress = validationResult.searchResult.suggestions[0];
        } else {
          return {
            success: false,
            error: 'No se encontró dirección oficial. Seleccione una alternativa.',
            progress: this.createEmptyProgress(deaRecordId)
          };
        }
      }
      
      // Determinar qué pasos son necesarios basándose en la dirección confirmada
      const stepsAnalysis = this.analyzeRequiredSteps(record, officialAddress);
      
      const progress: StepValidationProgress = {
        deaRecordId,
        currentStep: stepsAnalysis.nextStep,
        totalSteps: stepsAnalysis.totalSteps,
        steps: stepsAnalysis.steps,
        stepData: {
          step1: {
            selectedAddress: officialAddress,
            userConfirmed: true,
            timestamp: new Date()
          }
        },
        isComplete: stepsAnalysis.nextStep > 4
      };
      
      // Guardar progreso en base de datos
      await this.saveStepProgress(progress);
      
      return {
        success: true,
        progress,
        nextStep: stepsAnalysis.nextStep,
        message: stepsAnalysis.message
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en paso 1: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        progress: this.createEmptyProgress(deaRecordId)
      };
    }
  }
  
  /**
   * Ejecuta el Paso 2: Verificación de código postal
   */
  async executeStep2(
    deaRecordId: number,
    confirmedPostalCode: string
  ): Promise<StepValidationResult> {
    try {
      const progress = await this.getStepProgress(deaRecordId);
      if (!progress || !progress.stepData.step1) {
        return {
          success: false,
          error: 'Debe completar el paso 1 primero',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (!record) {
        return {
          success: false,
          error: 'Registro DEA no encontrado',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      // Actualizar progreso
      progress.stepData.step2 = {
        originalPostalCode: record.codigoPostal.toString(),
        confirmedPostalCode,
        userConfirmed: true,
        autoSkipped: false,
        timestamp: new Date()
      };
      
      // Marcar paso 2 como completado y determinar siguiente paso
      const step2Index = progress.steps.findIndex(s => s.stepNumber === 2);
      if (step2Index !== -1) {
        progress.steps[step2Index].status = 'completed';
      }
      
      // Determinar siguiente paso
      const nextStep = this.findNextRequiredStep(progress.steps, 3);
      progress.currentStep = nextStep;
      progress.isComplete = nextStep > 4;
      
      // Guardar progreso
      await this.saveStepProgress(progress);
      
      return {
        success: true,
        progress,
        nextStep,
        message: nextStep > 4 ? 'Validación completada' : `Continuando con paso ${nextStep}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en paso 2: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        progress: this.createEmptyProgress(deaRecordId)
      };
    }
  }
  
  /**
   * Ejecuta el Paso 3: Verificación de distrito
   */
  async executeStep3(
    deaRecordId: number,
    confirmedDistrict: number
  ): Promise<StepValidationResult> {
    try {
      const progress = await this.getStepProgress(deaRecordId);
      if (!progress || !progress.stepData.step1) {
        return {
          success: false,
          error: 'Debe completar los pasos anteriores primero',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (!record) {
        return {
          success: false,
          error: 'Registro DEA no encontrado',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      // Actualizar progreso
      progress.stepData.step3 = {
        originalDistrict: record.distrito,
        confirmedDistrict,
        userConfirmed: true,
        autoSkipped: false,
        timestamp: new Date()
      };
      
      // Marcar paso 3 como completado
      const step3Index = progress.steps.findIndex(s => s.stepNumber === 3);
      if (step3Index !== -1) {
        progress.steps[step3Index].status = 'completed';
      }
      
      // Determinar siguiente paso
      const nextStep = this.findNextRequiredStep(progress.steps, 4);
      progress.currentStep = nextStep;
      progress.isComplete = nextStep > 4;
      
      // Guardar progreso
      await this.saveStepProgress(progress);
      
      return {
        success: true,
        progress,
        nextStep,
        message: nextStep > 4 ? 'Validación completada' : `Continuando con paso ${nextStep}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en paso 3: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        progress: this.createEmptyProgress(deaRecordId)
      };
    }
  }
  
  /**
   * Ejecuta el Paso 4: Verificación de coordenadas
   */
  async executeStep4(
    deaRecordId: number,
    confirmedCoordinates: { lat: number; lng: number }
  ): Promise<StepValidationResult> {
    try {
      const progress = await this.getStepProgress(deaRecordId);
      if (!progress || !progress.stepData.step1) {
        return {
          success: false,
          error: 'Debe completar los pasos anteriores primero',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (!record) {
        return {
          success: false,
          error: 'Registro DEA no encontrado',
          progress: this.createEmptyProgress(deaRecordId)
        };
      }
      
      const distance = this.calculateDistance(
        record.latitud,
        record.longitud,
        confirmedCoordinates.lat,
        confirmedCoordinates.lng
      );
      
      // Actualizar progreso
      progress.stepData.step4 = {
        originalCoordinates: { lat: record.latitud, lng: record.longitud },
        confirmedCoordinates,
        distance,
        userConfirmed: true,
        autoSkipped: false,
        timestamp: new Date()
      };
      
      // Marcar paso 4 como completado
      const step4Index = progress.steps.findIndex(s => s.stepNumber === 4);
      if (step4Index !== -1) {
        progress.steps[step4Index].status = 'completed';
      }
      
      // Completar validación
      progress.currentStep = 5;
      progress.isComplete = true;
      progress.completedAt = new Date();
      
      // Guardar progreso y aplicar cambios al registro
      await this.saveStepProgress(progress);
      await this.applyValidationResults(progress);
      
      return {
        success: true,
        progress,
        nextStep: 5,
        message: 'Validación completada exitosamente'
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en paso 4: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        progress: this.createEmptyProgress(deaRecordId)
      };
    }
  }
  
  /**
   * Analiza qué pasos son necesarios basándose en la dirección confirmada
   */
  private analyzeRequiredSteps(
    record: DeaRecord | Record<string, unknown>,
    officialAddress: AddressSearchResult
  ): {
    steps: ValidationStep[];
    nextStep: number;
    totalSteps: number;
    message: string;
  } {
    const steps: ValidationStep[] = [
      {
        stepNumber: 1,
        title: 'Confirmar Dirección',
        status: 'completed',
        required: true
      }
    ];
    
    let nextStep = 5; // Asumir que todo está correcto
    let skippedSteps = 0;
    const messages: string[] = [];
    
    // Analizar código postal
    const recordCodigoPostal = typeof record.codigoPostal === 'number' ? record.codigoPostal : 
                               typeof record.codigoPostal === 'string' ? parseInt(record.codigoPostal, 10) : 0;
    const postalCodeMatches = recordCodigoPostal.toString() === officialAddress.codigoPostal;
    if (postalCodeMatches) {
      steps.push({
        stepNumber: 2,
        title: 'Verificar Código Postal',
        status: 'skipped',
        required: false,
        skipReason: `Código postal correcto (${officialAddress.codigoPostal})`
      });
      messages.push(`✅ Código postal correcto (${officialAddress.codigoPostal})`);
      skippedSteps++;
    } else {
      steps.push({
        stepNumber: 2,
        title: 'Verificar Código Postal',
        status: nextStep === 5 ? 'current' : 'pending',
        required: true
      });
      if (nextStep === 5) nextStep = 2;
      messages.push(`⚠️ Código postal requiere confirmación: ${recordCodigoPostal} → ${officialAddress.codigoPostal}`);
    }
    
    // Analizar distrito
    const recordDistrito = typeof record.distrito === 'string' ? record.distrito : '';
    const userDistrictNumber = this.extractDistrictNumber(recordDistrito);
    const districtMatches = userDistrictNumber === officialAddress.distrito;
    if (districtMatches) {
      steps.push({
        stepNumber: 3,
        title: 'Verificar Distrito',
        status: 'skipped',
        required: false,
        skipReason: `Distrito correcto (${officialAddress.distrito})`
      });
      messages.push(`✅ Distrito correcto (${officialAddress.distrito})`);
      skippedSteps++;
    } else {
      steps.push({
        stepNumber: 3,
        title: 'Verificar Distrito',
        status: nextStep === 5 ? 'current' : 'pending',
        required: true
      });
      if (nextStep === 5) nextStep = 3;
      messages.push(`⚠️ Distrito requiere confirmación: ${recordDistrito} → ${officialAddress.distrito}`);
    }
    
    // Analizar coordenadas
    const recordLatitud = typeof record.latitud === 'number' ? record.latitud : 0;
    const recordLongitud = typeof record.longitud === 'number' ? record.longitud : 0;
    
    if (officialAddress.latitud && officialAddress.longitud) {
      const distance = this.calculateDistance(
        recordLatitud,
        recordLongitud,
        officialAddress.latitud,
        officialAddress.longitud
      );
      
      const coordinatesValid = distance < 0.05; // 50 metros
      if (coordinatesValid) {
        steps.push({
          stepNumber: 4,
          title: 'Verificar Coordenadas',
          status: 'skipped',
          required: false,
          skipReason: `Coordenadas válidas (${Math.round(distance * 1000)}m de diferencia)`
        });
        messages.push(`✅ Coordenadas válidas (${Math.round(distance * 1000)}m)`);
        skippedSteps++;
      } else {
        steps.push({
          stepNumber: 4,
          title: 'Verificar Coordenadas',
          status: nextStep === 5 ? 'current' : 'pending',
          required: true
        });
        if (nextStep === 5) nextStep = 4;
        messages.push(`⚠️ Coordenadas requieren verificación (${Math.round(distance * 1000)}m de diferencia)`);
      }
    } else {
      // No hay coordenadas oficiales disponibles, requiere verificación manual
      steps.push({
        stepNumber: 4,
        title: 'Verificar Coordenadas',
        status: nextStep === 5 ? 'current' : 'pending',
        required: true
      });
      if (nextStep === 5) nextStep = 4;
      messages.push(`⚠️ Coordenadas requieren verificación manual (sin coordenadas oficiales de referencia)`);
    }
    
    const totalSteps = 4 - skippedSteps;
    const message = skippedSteps > 0 
      ? `Dirección confirmada. ${skippedSteps} paso(s) saltado(s) automáticamente. ${messages.join(' ')}`
      : 'Dirección confirmada. Continuando con verificaciones.';
    
    return {
      steps,
      nextStep,
      totalSteps,
      message
    };
  }
  
  /**
   * Encuentra el siguiente paso requerido
   */
  private findNextRequiredStep(steps: ValidationStep[], startFrom: number): number {
    for (let i = startFrom; i <= 4; i++) {
      const step = steps.find(s => s.stepNumber === i);
      if (step && step.required) {
        return i;
      }
    }
    return 5; // Todos los pasos completados
  }
  
  /**
   * Calcula distancia entre dos puntos en kilómetros
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
   * Guarda el progreso de validación usando VerificationRepository
   */
  private async saveStepProgress(progress: StepValidationProgress): Promise<void> {
    try {
      await verificationRepository.createOrUpdateForValidation(
        progress.deaRecordId,
        progress as unknown as Record<string, unknown>,
        'data_validation'
      );
    } catch (error) {
      console.error('Error guardando progreso de validación:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene el progreso de validación usando VerificationRepository
   */
  private async getStepProgress(deaRecordId: number): Promise<StepValidationProgress | null> {
    try {
      const session = await verificationRepository.findByDeaRecordIdForValidation(deaRecordId);
      if (session && session.stepData) {
        return session.stepData as unknown as StepValidationProgress;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo progreso de validación:', error);
      return null;
    }
  }
  
  /**
   * Aplica los resultados de validación al registro DEA
   */
  private async applyValidationResults(progress: StepValidationProgress): Promise<void> {
    const updateData: Record<string, unknown> = {};
    
    if (progress.stepData.step1) {
      const addr = progress.stepData.step1.selectedAddress;
      updateData.defTipoVia = addr.claseVia;
      updateData.defNombreVia = addr.nombreVia;
      updateData.defNumero = addr.numero;
    }
    
    if (progress.stepData.step2) {
      updateData.defCp = progress.stepData.step2.confirmedPostalCode;
    }
    
    if (progress.stepData.step3) {
      updateData.defDistrito = progress.stepData.step3.confirmedDistrict.toString();
    }
    
    if (progress.stepData.step4) {
      updateData.defLat = progress.stepData.step4.confirmedCoordinates.lat;
      updateData.defLon = progress.stepData.step4.confirmedCoordinates.lng;
    }
    
    if (Object.keys(updateData).length > 0) {
      await prisma.deaRecord.update({
        where: { id: progress.deaRecordId },
        data: updateData
      });
    }
  }
  
  /**
   * Crea progreso vacío
   */
  private createEmptyProgress(deaRecordId: number): StepValidationProgress {
    return {
      deaRecordId,
      currentStep: 1,
      totalSteps: 4,
      steps: [],
      stepData: {},
      isComplete: false
    };
  }
}

export const stepValidationService = new StepValidationService();
