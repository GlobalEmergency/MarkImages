#!/usr/bin/env tsx

/**
 * Script para ejecutar el pre-procesamiento de validaciones de direcciones
 * Uso: npm run preprocess-validations
 */

import { PrismaClient } from '@prisma/client';
import { newMadridValidationService } from '../src/services/newMadridValidationService';

const prisma = new PrismaClient();

interface ProcessingStats {
  totalRecords: number;
  processed: number;
  errors: number;
  duration: number;
  averageTime: number;
}

async function main() {
  console.log('🌙 === INICIO PRE-PROCESAMIENTO MANUAL ===');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  const errors: Array<{ recordId: number; error: string }> = [];

  try {
    // 1. Obtener registros que necesitan procesamiento
    const pendingRecords = await prisma.deaRecord.findMany({
      take: 100, // Limitar para pruebas
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 Encontrados ${pendingRecords.length} registros para procesar`);

    if (pendingRecords.length === 0) {
      console.log('✅ No hay registros pendientes de procesar');
      return;
    }

    // 2. Procesar registros en lotes
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pendingRecords.length / BATCH_SIZE);
      
      console.log(`📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} registros)`);
      
      // Procesar lote en paralelo
      const batchPromises = batch.map(async (record) => {
        try {
          const recordStartTime = Date.now();
          
          // Realizar validación
          const validation = await newMadridValidationService.validateAddress(
            record.tipoVia,
            record.nombreVia,
            record.numeroVia || undefined,
            record.codigoPostal.toString(),
            record.distrito,
            { latitude: record.latitud, longitude: record.longitud }
          );

          const processingTime = Date.now() - recordStartTime;

          // Guardar resultados usando Prisma Client
          await prisma.deaAddressValidation.upsert({
            where: { deaRecordId: record.id },
            create: {
              deaRecordId: record.id,
              searchResults: validation.searchResult.suggestions,
              validationDetails: validation.validationDetails,
              overallStatus: validation.overallStatus,
              recommendedActions: validation.recommendedActions,
              processingDurationMs: processingTime,
              searchStrategiesUsed: ['exact', 'fuzzy'],
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
              searchStrategiesUsed: ['exact', 'fuzzy'],
              processedAt: new Date(),
              needsReprocessing: false,
              errorMessage: null,
              retryCount: 0
            }
          });

          processedCount++;
          console.log(`✅ DEA ${record.id}: ${processingTime}ms`);
          
          return { success: true, recordId: record.id, processingTime };
          
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          
          console.error(`❌ DEA ${record.id}: ${errorMessage}`);
          
          errors.push({
            recordId: record.id,
            error: errorMessage
          });

          // Marcar como fallido
          try {
            await prisma.$executeRaw`
              INSERT INTO dea_address_validations (
                dea_record_id,
                search_results,
                overall_status,
                processing_duration_ms,
                needs_reprocessing,
                error_message,
                retry_count
              ) VALUES (
                ${record.id},
                '[]'::jsonb,
                'invalid',
                0,
                true,
                ${errorMessage},
                1
              )
              ON CONFLICT (dea_record_id) 
              DO UPDATE SET
                needs_reprocessing = true,
                error_message = EXCLUDED.error_message,
                processed_at = NOW(),
                retry_count = dea_address_validations.retry_count + 1,
                updated_at = NOW()
            `;
          } catch (dbError) {
            console.error(`❌ Error guardando fallo para DEA ${record.id}:`, dbError);
          }
          
          return { success: false, recordId: record.id, error: errorMessage };
        }
      });

      // Esperar a que termine el lote
      await Promise.allSettled(batchPromises);
      
      // Pausa entre lotes
      if (i + BATCH_SIZE < pendingRecords.length) {
        console.log('⏸️  Pausa entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalDuration = Date.now() - startTime;
    
    console.log('\n📊 === RESUMEN FINAL ===');
    console.log(`✅ Exitosos: ${processedCount}`);
    console.log(`❌ Fallidos: ${errorCount}`);
    console.log(`⏱️  Tiempo total: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`📈 Promedio por registro: ${processedCount > 0 ? Math.round(totalDuration / processedCount) : 0}ms`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errors.slice(0, 5).forEach(error => {
        console.log(`  - DEA ${error.recordId}: ${error.error}`);
      });
      if (errors.length > 5) {
        console.log(`  ... y ${errors.length - 5} errores más`);
      }
    }

    // Mostrar estadísticas de la tabla
    const stats = await prisma.$queryRaw`
      SELECT 
        overall_status,
        COUNT(*) as count
      FROM dea_address_validations 
      GROUP BY overall_status
    ` as Array<{ overall_status: string; count: bigint }>;

    console.log('\n📈 Estadísticas de validaciones:');
    stats.forEach(stat => {
      console.log(`  ${stat.overall_status}: ${stat.count} registros`);
    });

    console.log('🏁 === FIN PRE-PROCESAMIENTO ===\n');

  } catch (error) {
    console.error('💥 Error crítico en pre-procesamiento:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Error ejecutando script:', error);
    process.exit(1);
  });
}

export { main };
