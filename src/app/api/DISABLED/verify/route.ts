import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const statusFilter = searchParams.get('statusFilter') as 'all' | 'pending' | 'in_progress' | 'discarded' | null;

    // Validar parámetros
    if (page < 1 || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Parámetros de paginación inválidos' }, 
        { status: 400 }
      );
    }

    // Validar filtro de estado
    if (statusFilter && !['all', 'pending', 'in_progress', 'discarded'].includes(statusFilter)) {
      return NextResponse.json(
        { error: 'Filtro de estado inválido' }, 
        { status: 400 }
      );
    }

    let result;
    if (statusFilter && statusFilter !== 'all') {
      // Usar el método con filtros
      result = await verificationService.getDeaRecordsForVerificationWithFilters(page, limit, statusFilter);
    } else {
      // Usar el método original
      result = await verificationService.getDeaRecordsForVerificationPaginated(page, limit);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching DEA records for verification:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros para verificación' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deaId } = await request.json();
    
    if (!deaId) {
      return NextResponse.json(
        { error: 'ID del DEA es requerido' }, 
        { status: 400 }
      );
    }

    const session = await verificationService.startVerification(deaId);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error starting verification:', error);
    return NextResponse.json(
      { error: 'Error al iniciar verificación' }, 
      { status: 500 }
    );
  }
}
