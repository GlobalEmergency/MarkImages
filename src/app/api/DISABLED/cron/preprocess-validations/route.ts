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
    const errors: Array<{ recordId: string; error: string }> = [];

    // 1. Obtener registros que necesitan procesamiento
    const pendingRecords = await prisma.aed.findMany({
      where: {
        // Por ahora, procesar todos los registros para la primera ejecución
        // Más adelante se puede optimizar con la tabla de validaciones
      },
      take: 50, // Limitar a 50 registros por ejecución para evitar timeouts
      orderBy: { created_at: 'asc' },
      include: {
        location: {
          include: {
            district: true
          }
        }
      }
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
            record.location.street_type,
            record.location.street_name,
            record.location.street_number || undefined,
            record.location.postal_code,
            record.location.district.name,
            { latitude: record.latitude, longitude: record.longitude }
          );

          const processingTime = Date.now() - recordStartTime;

          // Guardar resultados en la nueva tabla aed_address_validations
          await prisma.$executeRaw`
            INSERT INTO aed_address_validations (
              id,
              location_id,
              suggestions,
              detected_problems,
              recommended_actions,
              address_found,
              match_level,
              duration_ms,
              strategies_used,
              processed_at
            ) VALUES (
              gen_random_uuid(),
              ${record.location_id}::uuid,
              ${JSON.stringify(validation.searchResult.suggestions)}::jsonb,
              ${JSON.stringify(validation.validationDetails?.problems || [])}::jsonb,
              ${JSON.stringify(validation.recommendedActions)}::jsonb,
              ${validation.overallStatus === 'valid'},
              ${validation.searchResult.matchLevel || 0.0},
              ${processingTime},
              ${JSON.stringify(['exact', 'fuzzy'])}::jsonb,
              NOW()
            )
            ON CONFLICT (location_id)
            DO UPDATE SET
              suggestions = EXCLUDED.suggestions,
              detected_problems = EXCLUDED.detected_problems,
              recommended_actions = EXCLUDED.recommended_actions,
              address_found = EXCLUDED.address_found,
              match_level = EXCLUDED.match_level,
              duration_ms = EXCLUDED.duration_ms,
              strategies_used = EXCLUDED.strategies_used,
              processed_at = NOW()
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
              INSERT INTO aed_address_validations (
                id,
                location_id,
                suggestions,
                address_found,
                detected_problems,
                duration_ms,
                processed_at
              ) VALUES (
                gen_random_uuid(),
                ${record.location_id}::uuid,
                '[]'::jsonb,
                false,
                ${JSON.stringify([{ type: 'error', message: errorMessage }])}::jsonb,
                0,
                NOW()
              )
              ON CONFLICT (location_id)
              DO UPDATE SET
                address_found = false,
                detected_problems = ${JSON.stringify([{ type: 'error', message: errorMessage }])}::jsonb,
                processed_at = NOW()
            `;
          } catch (dbError) {
            console.error(`❌ Error guardando fallo para AED ${record.id}:`, dbError);
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
