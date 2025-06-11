import { NextRequest, NextResponse } from 'next/server';
import { stepValidationService } from '@/services/stepValidationService';
import { newMadridValidationService } from '@/services/newMadridValidationService';
import { AddressSearchResult } from '@/types/address';

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

    // Si es el paso 1, también obtener las opciones de direcciones
    if (result.progress.currentStep === 1) {
      // Obtener datos del registro para hacer la búsqueda
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const record = await prisma.deaRecord.findUnique({
        where: { id: deaRecordId }
      });
      
      if (record) {
        const validationResult = await newMadridValidationService.validateAddress(
          record.tipoVia,
          record.nombreVia,
          record.numeroVia || undefined,
          record.codigoPostal.toString(),
          record.distrito,
          { latitude: record.latitud, longitude: record.longitud }
        );
        
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
          data: {
            progress: result.progress,
            step1Data: {
              searchResult: {
                found: validationResult.searchResult.isValid,
                officialData: validationResult.searchResult.suggestions.length > 0 ? 
                  mapAddressForFrontend(validationResult.searchResult.suggestions[0]) : null,
                alternatives: validationResult.searchResult.suggestions.slice(1).map(mapAddressForFrontend),
                exactMatch: validationResult.searchResult.matchType === 'exact'
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
              message: result.message
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
