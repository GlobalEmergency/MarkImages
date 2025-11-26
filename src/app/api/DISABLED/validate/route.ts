import { NextRequest, NextResponse } from 'next/server';
import { deaValidationService } from '@/services/deaValidationService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const deaRecordId = parseInt(resolvedParams.id);
    
    if (isNaN(deaRecordId)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }
    
    const validation = await deaValidationService.validateDeaRecord(deaRecordId);
    
    return NextResponse.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    console.error('Error validando registro DEA:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const deaRecordId = parseInt(resolvedParams.id);
    
    if (isNaN(deaRecordId)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const {
      applyGeographic = false,
      applyTextNormalization = false,
      applyDeaCode = false,
      manualOverrides = {}
    } = body;
    
    const result = await deaValidationService.applyValidationCorrections(
      deaRecordId,
      {
        applyGeographic,
        applyTextNormalization,
        applyDeaCode,
        manualOverrides
      }
    );
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          updatedFields: result.updatedFields,
          message: `Se actualizaron ${result.updatedFields.length} campos`
        }
      });
    } else {
      return NextResponse.json(
        { 
          error: 'Error aplicando correcciones',
          details: result.errors
        },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error aplicando correcciones:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
