import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'id' | 'provisional';
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: 'Parámetros type y value son requeridos' }, 
        { status: 400 }
      );
    }

    if (!['id', 'provisional'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de búsqueda inválido. Use "id" o "provisional"' }, 
        { status: 400 }
      );
    }

    const numericValue = parseInt(value);
    if (isNaN(numericValue)) {
      return NextResponse.json(
        { error: 'El valor debe ser un número válido' }, 
        { status: 400 }
      );
    }

    let result;
    if (type === 'id') {
      result = await verificationService.searchDeaById(numericValue);
    } else {
      result = await verificationService.searchDeaByProvisionalNumber(numericValue);
    }

    if (!result) {
      return NextResponse.json(
        { error: 'DEA no encontrado o no tiene imágenes disponibles' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching DEA:', error);
    return NextResponse.json(
      { error: 'Error al buscar el DEA' }, 
      { status: 500 }
    );
  }
}
