import { NextRequest, NextResponse } from 'next/server';
import { stepValidationService } from '@/services/stepValidationService';
import { newMadridValidationService } from '@/services/newMadridValidationService';
import { AddressSearchResult, ComprehensiveAddressValidation } from '@/types/address';
import { PrismaClient } from '@prisma/client';

// Usar instancia global en lugar de importación dinámica
const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deaRecordId = parseInt(id);
    
    if (isNaN(deaRecordId)) {
      return NextResponse.json(
        { success: false, error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    // Inicializar validación paso a paso
    const result = await stepValidationService.initializeStepValidation(deaRecordId);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Si es el paso 1, buscar datos pre-procesados primero
    if (result.progress.currentStep === 1) {
      console.log(`🔍 DEBUG: Iniciando validación para DEA ${deaRecordId}`);
      
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });

      if (!record) {
        return NextResponse.json(
          { success: false, error: 'Registro DEA no encontrado' },
          { status: 404 }
        );
      }

      console.log(`📋 DEBUG: Registro DEA encontrado: ${record.tipoVia} ${record.nombreVia} ${record.numeroVia}`);

      // 🚀 ESTRATEGIA 1: Buscar datos pre-calculados (con debugging detallado)
      let preCalculated: Array<{
        search_results: unknown;
        validation_details: unknown;
        overall_status: string;
        recommended_actions: unknown;
        processing_duration_ms: number;
        needs_reprocessing: boolean;
        processed_at: Date;
      }> = [];

      try {
        console.log(`🔍 DEBUG: Verificando si existe tabla dea_address_validations...`);
        
        // Primero verificar si la tabla existe
        const tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'dea_address_validations'
          );
        ` as Array<{ exists: boolean }>;

        console.log(`📊 DEBUG: ¿Tabla existe?:`, tableExists[0]?.exists);

        if (tableExists[0]?.exists) {
          console.log(`🔍 DEBUG: Buscando datos pre-calculados para DEA ${deaRecordId}...`);
          
          preCalculated = await prisma.$queryRaw`
            SELECT 
              search_results,
              validation_details,
              overall_status,
              recommended_actions,
              processing_duration_ms,
              needs_reprocessing,
              processed_at
            FROM dea_address_validations 
            WHERE dea_record_id = ${deaRecordId}
            AND needs_reprocessing = false
            LIMIT 1
          ` as Array<{
            search_results: unknown;
            validation_details: unknown;
            overall_status: string;
            recommended_actions: unknown;
            processing_duration_ms: number;
            needs_reprocessing: boolean;
            processed_at: Date;
          }>;

          console.log(`📊 DEBUG: Datos pre-calculados encontrados:`, preCalculated.length);
        } else {
          console.warn(`⚠️ DEBUG: Tabla dea_address_validations no existe`);
        }
      } catch (dbError) {
        console.error(`❌ DEBUG: Error accediendo a tabla de pre-procesamiento:`, dbError);
        console.warn(`⚠️ Tabla de pre-procesamiento no disponible, usando procesamiento en tiempo real para DEA ${deaRecordId}`);
      }

      if (preCalculated.length > 0) {
        // ⚡ RESPUESTA INSTANTÁNEA con datos pre-calculados
        const preCalc = preCalculated[0];
        console.log(`⚡ Usando datos pre-calculados para DEA ${deaRecordId} (${preCalc.processing_duration_ms}ms)`);
        
        // Mapear resultados pre-calculados al formato esperado
        const mapAddressForFrontend = (address: AddressSearchResult) => ({
          tipoVia: address.claseVia,
          nombreVia: address.nombreViaAcentos,
          numeroVia: address.numero,
          codigoPostal: address.codigoPostal,
          distrito: address.distrito,
          latitud: address.latitud,
          longitud: address.longitud,
          confidence: address.confidence
        });

        const searchResults = Array.isArray(preCalc.search_results) ? preCalc.search_results : [];

        return NextResponse.json({
          success: true,
          source: 'preprocessed', // Indicar que viene de pre-procesamiento
          data: {
            progress: result.progress,
            step1Data: {
              searchResult: {
                found: searchResults.length > 0,
                officialData: searchResults.length > 0 ? mapAddressForFrontend(searchResults[0]) : null,
                alternatives: searchResults.slice(1).map(mapAddressForFrontend),
                exactMatch: searchResults.length > 0 && searchResults[0].matchType === 'exact'
              },
              originalRecord: {
                tipoVia: record.tipoVia,
                nombreVia: record.nombreVia,
                numeroVia: record.numeroVia,
                complementoDireccion: record.complementoDireccion,
                codigoPostal: record.codigoPostal,
                distrito: record.distrito,
                latitud: record.latitud,
                longitud: record.longitud
              },
              message: `✅ Validación pre-procesada (${preCalc.processing_duration_ms}ms) - ${preCalc.processed_at.toLocaleString()}`
            }
          }
        });
      }

      // 🔄 ESTRATEGIA 2: Procesamiento en tiempo real (fallback)
      console.log(`🔄 Procesando en tiempo real DEA ${deaRecordId}`);
      
      // Marcar para reprocesamiento en el próximo cron (si la tabla existe)
      try {
        await prisma.$executeRaw`
          INSERT INTO dea_address_validations (
            dea_record_id,
            needs_reprocessing,
            overall_status,
            updated_at
          ) VALUES (
            ${deaRecordId},
            true,
            'pending',
            NOW()
          )
          ON CONFLICT (dea_record_id) 
          DO UPDATE SET
            needs_reprocessing = true,
            updated_at = NOW()
        `;
      } catch {
        console.warn(`⚠️ No se pudo marcar para reprocesamiento DEA ${deaRecordId} - tabla no disponible`);
      }

      // Continuar con procesamiento original pero con timeout
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000) // 15 segundos timeout
        );
        
        const validationPromise = newMadridValidationService.validateAddress(
          record.tipoVia,
          record.nombreVia,
          record.numeroVia || undefined,
          record.codigoPostal.toString(),
          record.distrito,
          { latitude: record.latitud, longitude: record.longitud }
        );

        const validationResult = await Promise.race([validationPromise, timeoutPromise]) as ComprehensiveAddressValidation;
        
        // Mapear el primer resultado para el frontend
        const mapAddressForFrontend = (address: AddressSearchResult) => ({
          tipoVia: address.claseVia,
          nombreVia: address.nombreViaAcentos,
          numeroVia: address.numero,
          codigoPostal: address.codigoPostal,
          distrito: address.distrito,
          latitud: address.latitud,
          longitud: address.longitud,
          confidence: address.confidence
        });

        return NextResponse.json({
          success: true,
          source: 'realtime',
          data: {
            progress: result.progress,
            step1Data: {
              searchResult: {
                found: validationResult?.searchResult?.isValid || false,
                officialData: validationResult?.searchResult?.suggestions?.length > 0 ? 
                  mapAddressForFrontend(validationResult.searchResult.suggestions[0]) : null,
                alternatives: (validationResult?.searchResult?.suggestions || []).slice(1).map(mapAddressForFrontend),
                exactMatch: validationResult?.searchResult?.matchType === 'exact'
              },
              originalRecord: {
                tipoVia: record.tipoVia,
                nombreVia: record.nombreVia,
                numeroVia: record.numeroVia,
                complementoDireccion: record.complementoDireccion,
                codigoPostal: record.codigoPostal,
                distrito: record.distrito,
                latitud: record.latitud,
                longitud: record.longitud
              },
              message: '🔄 Procesado en tiempo real'
            }
          }
        });

      } catch (error) {
        // Si hay timeout o error, devolver respuesta parcial
        console.warn(`⚠️ Timeout/Error en procesamiento tiempo real para DEA ${deaRecordId}:`, error);
        
        return NextResponse.json({
          success: true,
          source: 'partial',
          data: {
            progress: result.progress,
            step1Data: {
              searchResult: {
                found: false,
                officialData: null,
                alternatives: [],
                exactMatch: false
              },
              originalRecord: {
                tipoVia: record.tipoVia,
                nombreVia: record.nombreVia,
                numeroVia: record.numeroVia,
                complementoDireccion: record.complementoDireccion,
                codigoPostal: record.codigoPostal,
                distrito: record.distrito,
                latitud: record.latitud,
                longitud: record.longitud
              },
              message: '⏳ Procesando en segundo plano. Los datos estarán disponibles en el próximo cron job.'
            }
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        progress: result.progress,
        message: result.message
      }
    });

  } catch (error) {
    console.error('Error en validación por pasos:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deaRecordId = parseInt(id);
    const body = await request.json();
    
    if (isNaN(deaRecordId)) {
      return NextResponse.json(
        { success: false, error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    const { step, data } = body;

    let result;

    switch (step) {
      case 1:
        result = await stepValidationService.executeStep1(
          deaRecordId,
          data.selectedAddress
        );
        break;
        
      case 2:
        result = await stepValidationService.executeStep2(
          deaRecordId,
          data.confirmedPostalCode
        );
        break;
        
      case 3:
        result = await stepValidationService.executeStep3(
          deaRecordId,
          data.confirmedDistrict
        );
        break;
        
      case 4:
        result = await stepValidationService.executeStep4(
          deaRecordId,
          data.confirmedCoordinates
        );
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: 'Paso de validación inválido' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        progress: result.progress,
        nextStep: result.nextStep,
        message: result.message,
        isComplete: result.progress.isComplete
      }
    });

  } catch (error) {
    console.error('Error ejecutando paso de validación:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
