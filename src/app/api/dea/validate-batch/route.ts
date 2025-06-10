import { NextRequest, NextResponse } from 'next/server';
import { deaValidationService } from '@/services/deaValidationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      deaRecordIds = [],
      autoApplyCorrections = false,
      maxConcurrent = 5
    } = body;
    
    // Validar entrada
    if (!Array.isArray(deaRecordIds) || deaRecordIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de IDs de registros DEA' },
        { status: 400 }
      );
    }
    
    if (deaRecordIds.length > 100) {
      return NextResponse.json(
        { error: 'No se pueden validar más de 100 registros a la vez' },
        { status: 400 }
      );
    }
    
    // Validar que todos los IDs sean números
    const invalidIds = deaRecordIds.filter(id => !Number.isInteger(id) || id <= 0);
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `IDs inválidos encontrados: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }
    
    const result = await deaValidationService.validateBatch(
      deaRecordIds,
      {
        autoApplyCorrections,
        maxConcurrent: Math.min(maxConcurrent, 10) // Limitar concurrencia máxima
      }
    );
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          processed: result.processed,
          successful: result.successful,
          withIssues: result.withIssues,
          failed: result.failed,
          successRate: result.processed > 0 ? (result.successful / result.processed * 100).toFixed(1) : '0'
        },
        results: result.results,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('Error en validación en lote:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Obtener estadísticas de validación
    const stats = await deaValidationService.getValidationStats();
    
    return NextResponse.json({
      success: true,
      data: {
        stats,
        pagination: {
          limit,
          offset,
          total: stats.total
        }
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
