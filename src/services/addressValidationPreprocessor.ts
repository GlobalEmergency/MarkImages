import { PrismaClient } from '@prisma/client';
import { newMadridValidationService } from './newMadridValidationService';
import { ComprehensiveAddressValidation } from '../types/address';

const prisma = new PrismaClient();

// Type assertion to access deaAddressValidation model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deaAddressValidation = (prisma as any).deaAddressValidation;

interface ProcessingStats {
  totalRecords: number;
  successful: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  averageProcessingTime: number;
  errors: Array<{ recordId: number; error: string }>;
  globalError?: string;
}

class ProcessingStatsCollector implements ProcessingStats {
  totalRecords = 0;
  successful = 0;
  failed = 0;
  skipped = 0;
  totalDuration = 0;
  errors: Array<{ recordId: number; error: string }> = [];
  globalError?: string;

  get averageProcessingTime(): number {
    const processed = this.successful + this.failed;
    return processed > 0 ? this.totalDuration / processed : 0;
  }

  merge(other: ProcessingStatsCollector): void {
    this.successful += other.successful;
    this.failed += other.failed;
    this.skipped += other.skipped;
    this.totalDuration += other.totalDuration;
    this.errors.push(...other.errors);
  }

  toJSON() {
    return {
      totalRecords: this.totalRecords,
      successful: this.successful,
      failed: this.failed,
      skipped: this.skipped,
      totalDuration: this.totalDuration,
      averageProcessingTime: this.averageProcessingTime,
      errorCount: this.errors.length,
      globalError: this.globalError
    };
  }
}

export class AddressValidationPreprocessor {
  private readonly BATCH_SIZE = 25;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESSING_DELAY = 500; // ms entre registros
  private readonly TIMEOUT_MS = 30000; // 30 segundos timeout por registro

  /**
   * Procesa todos los registros DEA pendientes de validación
   */
  async processAllPendingRecords(): Promise<ProcessingStats> {
    const stats = new ProcessingStatsCollector();
    const startTime = Date.now();

    try {
      // 1. Obtener registros pendientes
      const pendingRecords = await this.getPendingRecords();
      stats.totalRecords = pendingRecords.length;

      console.log(`🎯 Iniciando procesamiento de ${pendingRecords.length} registros DEA`);

      if (pendingRecords.length === 0) {
        console.log('✅ No hay registros pendientes de procesar');
        return stats;
      }

      // 2. Procesar en lotes
      for (let i = 0; i < pendingRecords.length; i += this.BATCH_SIZE) {
        const batch = pendingRecords.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pendingRecords.length / this.BATCH_SIZE);

        console.log(`📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} registros)`);

        const batchStats = await this.processBatch(batch, batchNumber);
        stats.merge(batchStats);

        // Pausa entre lotes para no saturar la BD
        if (i + this.BATCH_SIZE < pendingRecords.length) {
          await this.sleep(2000);
        }
      }

      stats.totalDuration = Date.now() - startTime;
      return stats;

    } catch (error) {
      console.error('❌ Error en procesamiento masivo:', error);
      stats.globalError = error instanceof Error ? error.message : 'Error desconocido';
      stats.totalDuration = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Procesa solo registros recientes (últimas 4 horas)
   */
  async processRecentRecords(): Promise<ProcessingStats> {
    const stats = new ProcessingStatsCollector();
    const startTime = Date.now();

    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      // Obtener IDs de registros que necesitan reprocesamiento
      const validationsToReprocess = await deaAddressValidation.findMany({
        where: {
          OR: [
            { needsReprocessing: true },
            { processedAt: { lt: fourHoursAgo } }
          ]
        },
        select: { deaRecordId: true }
      });

      const reprocessIds = validationsToReprocess.map((v: { deaRecordId: number }) => v.deaRecordId);

      const recentRecords = await prisma.deaRecord.findMany({
        where: {
          OR: [
            { createdAt: { gte: fourHoursAgo } },
            { updatedAt: { gte: fourHoursAgo } },
            { id: { in: reprocessIds } }
          ]
        }
      });

      stats.totalRecords = recentRecords.length;
      console.log(`🔄 Procesamiento incremental: ${recentRecords.length} registros recientes`);

      if (recentRecords.length === 0) {
        console.log('✅ No hay registros recientes que procesar');
        return stats;
      }

      // Procesar en lotes más pequeños para procesamiento incremental
      const incrementalBatchSize = Math.min(this.BATCH_SIZE, 10);
      
      for (let i = 0; i < recentRecords.length; i += incrementalBatchSize) {
        const batch = recentRecords.slice(i, i + incrementalBatchSize);
        const batchStats = await this.processBatch(batch, i + 1);
        stats.merge(batchStats);

        // Pausa más corta para procesamiento incremental
        if (i + incrementalBatchSize < recentRecords.length) {
          await this.sleep(1000);
        }
      }

      stats.totalDuration = Date.now() - startTime;
      return stats;

    } catch (error) {
      console.error('❌ Error en procesamiento incremental:', error);
      stats.globalError = error instanceof Error ? error.message : 'Error desconocido';
      stats.totalDuration = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Obtiene registros DEA que necesitan procesamiento
   */
  private async getPendingRecords() {
    // Obtener IDs de registros que ya tienen validación
    const existingValidations = await deaAddressValidation.findMany({
      select: { 
        deaRecordId: true,
        needsReprocessing: true,
        retryCount: true,
        errorMessage: true
      }
    });

    const existingIds = existingValidations.map((v: { deaRecordId: number }) => v.deaRecordId);
    const needsReprocessingIds = existingValidations
      .filter((v: { needsReprocessing: boolean; errorMessage: string | null; retryCount: number }) => 
        v.needsReprocessing || (v.errorMessage && v.retryCount < this.MAX_RETRIES))
      .map((v: { deaRecordId: number }) => v.deaRecordId);

    return await prisma.deaRecord.findMany({
      where: {
        OR: [
          // Registros sin validación
          { id: { notIn: existingIds } },
          // Registros que necesitan reprocesamiento
          { id: { in: needsReprocessingIds } }
        ]
      },
      orderBy: [
        { createdAt: 'asc' }, // Procesar primero los más antiguos
        { id: 'asc' }
      ]
    });
  }

  /**
   * Procesa un lote de registros
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processBatch(records: any[], batchNumber: number): Promise<ProcessingStatsCollector> {
    const batchStats = new ProcessingStatsCollector();

    // Procesar registros en paralelo con límite de concurrencia
    const promises = records.map(record => 
      this.processRecordWithRetry(record)
        .then(result => ({ success: true, recordId: record.id, result }))
        .catch(error => ({ 
          success: false, 
          recordId: record.id, 
          error: error instanceof Error ? error.message : 'Error desconocido'
        }))
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success && 'result' in result.value) {
          batchStats.successful++;
          const processingTime = result.value.result?.processingTime || 0;
          console.log(`✅ DEA ${records[index].id}: ${processingTime}ms`);
        } else {
          batchStats.failed++;
          batchStats.errors.push({
            recordId: result.value.recordId,
            error: 'error' in result.value ? result.value.error : 'Unknown error'
          });
          console.log(`❌ DEA ${records[index].id}: ${'error' in result.value ? result.value.error : 'Unknown error'}`);
        }
      } else {
        batchStats.failed++;
        batchStats.errors.push({
          recordId: records[index].id,
          error: result.reason
        });
        console.log(`❌ DEA ${records[index].id}: ${result.reason}`);
      }
    });

    console.log(`📊 Lote ${batchNumber}: ${batchStats.successful} exitosos, ${batchStats.failed} fallidos`);
    return batchStats;
  }

  /**
   * Procesa un registro con reintentos
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processRecordWithRetry(record: any): Promise<{ processingTime: number }> {
    const maxRetries = record.addressValidation?.retryCount || 0;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES - maxRetries; attempt++) {
      try {
        const result = await this.processRecord(record);
        return result;
      } catch (error) {
        const isLastAttempt = attempt === this.MAX_RETRIES - maxRetries;
        
        if (isLastAttempt) {
          // Marcar como fallido después de todos los reintentos
          await this.markAsFailed(record.id, error instanceof Error ? error.message : 'Error desconocido');
          throw error;
        } else {
          // Incrementar contador de reintentos y continuar
          await this.incrementRetryCount(record.id);
          await this.sleep(1000 * (attempt + 1)); // Backoff exponencial
        }
      }
    }

    throw new Error('Se agotaron todos los reintentos');
  }

  /**
   * Procesa un registro individual
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processRecord(record: any): Promise<{ processingTime: number }> {
    const startTime = Date.now();

    try {
      // Crear timeout para evitar procesos colgados
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout de procesamiento')), this.TIMEOUT_MS);
      });

      // Procesar validación con timeout
      const validationPromise = this.performValidation(record);
      const validation = await Promise.race([validationPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;

      // Guardar resultados pre-calculados
      await this.saveValidationResults(record.id, validation, processingTime);

      console.log(`✅ Procesado DEA ${record.id} en ${processingTime}ms`);
      return { processingTime };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error procesando DEA ${record.id}:`, error);
      
      // Marcar como fallido pero no bloquear el proceso
      await this.markAsFailed(
        record.id, 
        error instanceof Error ? error.message : 'Error desconocido',
        processingTime
      );
      
      throw error;
    }
  }

  /**
   * Realiza la validación de dirección
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async performValidation(record: any): Promise<ComprehensiveAddressValidation> {
    return await newMadridValidationService.validateAddress(
      record.tipoVia,
      record.nombreVia,
      record.numeroVia || undefined,
      record.codigoPostal.toString(),
      record.distrito,
      { latitude: record.latitud, longitude: record.longitud }
    );
  }

  /**
   * Guarda los resultados de validación en la base de datos
   */
  private async saveValidationResults(
    deaRecordId: number, 
    validation: ComprehensiveAddressValidation, 
    processingTime: number
  ): Promise<void> {
    await deaAddressValidation.upsert({
      where: { deaRecordId },
      create: {
        deaRecordId,
        searchResults: validation.searchResult.suggestions,
        validationDetails: validation.validationDetails,
        overallStatus: validation.overallStatus,
        recommendedActions: validation.recommendedActions,
        processingDurationMs: processingTime,
        searchStrategiesUsed: this.getUsedStrategies(validation),
        needsReprocessing: false,
        errorMessage: null,
        retryCount: 0
      },
      update: {
        searchResults: validation.searchResult.suggestions,
        validationDetails: validation.validationDetails,
        overallStatus: validation.overallStatus,
        recommendedActions: validation.recommendedActions,
        processingDurationMs: processingTime,
        searchStrategiesUsed: this.getUsedStrategies(validation),
        processedAt: new Date(),
        needsReprocessing: false,
        errorMessage: null,
        retryCount: 0
      }
    });
  }

  /**
   * Marca un registro como fallido
   */
  private async markAsFailed(deaRecordId: number, errorMessage: string, processingTime?: number): Promise<void> {
    await deaAddressValidation.upsert({
      where: { deaRecordId },
      create: {
        deaRecordId,
        searchResults: [],
        overallStatus: 'invalid',
        processingDurationMs: processingTime || 0,
        needsReprocessing: true,
        errorMessage,
        retryCount: 1
      },
      update: {
        needsReprocessing: true,
        errorMessage,
        processedAt: new Date(),
        retryCount: { increment: 1 }
      }
    });
  }

  /**
   * Incrementa el contador de reintentos
   */
  private async incrementRetryCount(deaRecordId: number): Promise<void> {
    await deaAddressValidation.upsert({
      where: { deaRecordId },
      create: {
        deaRecordId,
        retryCount: 1,
        needsReprocessing: true
      },
      update: {
        retryCount: { increment: 1 }
      }
    });
  }

  /**
   * Extrae las estrategias de búsqueda utilizadas
   */
  private getUsedStrategies(validation: ComprehensiveAddressValidation): string[] {
    const strategies: string[] = [];
    
    if (validation.searchResult.suggestions.length > 0) {
      const matchTypes = validation.searchResult.suggestions.map(s => s.matchType);
      
      if (matchTypes.includes('exact')) strategies.push('exact');
      if (matchTypes.includes('fuzzy')) strategies.push('fuzzy');
      if (matchTypes.includes('geographic')) strategies.push('geographic');
    }
    
    return strategies.length > 0 ? strategies : ['none'];
  }

  /**
   * Pausa la ejecución por el tiempo especificado
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas del estado actual de validaciones
   */
  async getValidationStats() {
    const stats = await deaAddressValidation.groupBy({
      by: ['overallStatus'],
      _count: {
        id: true
      }
    });

    const needsReprocessing = await deaAddressValidation.count({
      where: { needsReprocessing: true }
    });

    const withErrors = await deaAddressValidation.count({
      where: { errorMessage: { not: null } }
    });

    const totalRecords = await prisma.deaRecord.count();
    const processedRecords = await deaAddressValidation.count();

    return {
      totalRecords,
      processedRecords,
      pendingRecords: totalRecords - processedRecords,
      needsReprocessing,
      withErrors,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statusBreakdown: stats.reduce((acc: any, stat: any) => {
        acc[stat.overallStatus] = stat._count.id;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const addressValidationPreprocessor = new AddressValidationPreprocessor();
