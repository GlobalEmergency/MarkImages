import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { newMadridValidationService } from '@/services/newMadridValidationService';

const prisma = new PrismaClient();

// Verificar que la llamada viene de Vercel Cron
function isAuthorizedCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('⚠️ CRON_SECRET no está configurado');
    return true; // Permitir en desarrollo
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autorización
    if (!isAuthorizedCronRequest(request)) {
      console.error('❌ Llamada no autorizada al cron');
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    console.log('🌙 === INICIO PRE-PROCESAMIENTO CRON ===');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;
    const errors: Array<{ recordId: number; error: string }> = [];

    // 1. Obtener registros que necesitan procesamiento
    const pendingRecords = await prisma.deaRecord.findMany({
      where: {
        // Por ahora, procesar todos los registros para la primera ejecución
        // Más adelante se puede optimizar con la tabla de validaciones
      },
      take: 50, // Limitar a 50 registros por ejecución para evitar timeouts
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 Encontrados ${pendingRecords.length} registros para procesar`);

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay registros pendientes',
        stats: {
          processed: 0,
          errors: 0,
          duration: Date.now() - startTime
        }
      });
    }

    // 2. Procesar registros en lotes pequeños
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} registros)`);
      
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

          // Guardar resultados usando SQL directo (corregido)
          await prisma.$executeRaw`
            INSERT INTO dea_address_validations (
              dea_record_id,
              search_results,
              validation_details,
              overall_status,
              recommended_actions,
              processing_duration_ms,
              search_strategies_used,
              needs_reprocessing,
              error_message,
              retry_count,
              updated_at
            ) VALUES (
              ${record.id},
              ${JSON.stringify(validation.searchResult.suggestions)}::jsonb,
              ${JSON.stringify(validation.validationDetails)}::jsonb,
              ${validation.overallStatus},
              ${JSON.stringify(validation.recommendedActions)}::jsonb,
              ${processingTime},
              ${JSON.stringify(['exact', 'fuzzy'])}::jsonb,
              false,
              null,
              0,
              NOW()
            )
            ON CONFLICT (dea_record_id) 
            DO UPDATE SET
              search_results = EXCLUDED.search_results,
              validation_details = EXCLUDED.validation_details,
              overall_status = EXCLUDED.overall_status,
              recommended_actions = EXCLUDED.recommended_actions,
              processing_duration_ms = EXCLUDED.processing_duration_ms,
              search_strategies_used = EXCLUDED.search_strategies_used,
              processed_at = NOW(),
              needs_reprocessing = false,
              error_message = null,
              retry_count = 0,
              updated_at = NOW()
          `;

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
      
      // Pausa entre lotes para no saturar
      if (i + BATCH_SIZE < pendingRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalDuration = Date.now() - startTime;
    
    console.log('\n📊 === RESUMEN FINAL ===');
    console.log(`✅ Exitosos: ${processedCount}`);
    console.log(`❌ Fallidos: ${errorCount}`);
    console.log(`⏱️  Tiempo total: ${totalDuration}ms`);
    console.log(`📈 Promedio por registro: ${processedCount > 0 ? Math.round(totalDuration / processedCount) : 0}ms`);
    console.log('🏁 === FIN PRE-PROCESAMIENTO ===\n');

    // Enviar métricas si está configurado
    if (process.env.MONITORING_WEBHOOK) {
      try {
        await fetch(process.env.MONITORING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'dea-address-preprocessing',
            timestamp: new Date().toISOString(),
            stats: {
              processed: processedCount,
              errors: errorCount,
              duration: totalDuration,
              averageTime: processedCount > 0 ? Math.round(totalDuration / processedCount) : 0
            }
          })
        });
      } catch (webhookError) {
        console.error('❌ Error enviando métricas:', webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Procesamiento completado: ${processedCount} exitosos, ${errorCount} fallidos`,
      stats: {
        processed: processedCount,
        errors: errorCount,
        duration: totalDuration,
        averageTime: processedCount > 0 ? Math.round(totalDuration / processedCount) : 0,
        errorDetails: errors.slice(0, 10) // Solo primeros 10 errores
      }
    });

  } catch (error) {
    console.error('💥 Error crítico en pre-procesamiento:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// También permitir POST para testing manual
export async function POST(request: NextRequest) {
  return GET(request);
}
