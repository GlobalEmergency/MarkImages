import { NextRequest, NextResponse } from 'next/server';
import { SimpleVerificationService } from '@/services/simpleVerificationService';

const verificationService = new SimpleVerificationService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    const { arrowData } = await request.json();
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    if (!arrowData) {
      return NextResponse.json(
        { error: 'Datos de flecha son requeridos' }, 
        { status: 400 }
      );
    }

    // Validar datos de flecha
    const { startX, startY, endX, endY, color, width } = arrowData;
    if (typeof startX !== 'number' || typeof startY !== 'number' || 
        typeof endX !== 'number' || typeof endY !== 'number' ||
        typeof color !== 'string' || typeof width !== 'number') {
      return NextResponse.json(
        { error: 'Datos de flecha inválidos' }, 
        { status: 400 }
      );
    }

    const arrowMarker = await verificationService.saveArrowMarker(sessionId, arrowData);
    return NextResponse.json(arrowMarker);
  } catch (error) {
    console.error('Error saving arrow marker:', error);
    return NextResponse.json(
      { error: 'Error al guardar marcador de flecha' }, 
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    const arrows = await verificationService.getArrowMarkers(sessionId);
    return NextResponse.json(arrows);
  } catch (error) {
    console.error('Error fetching arrow markers:', error);
    return NextResponse.json(
      { error: 'Error al obtener marcadores de flecha' }, 
      { status: 500 }
    );
  }
}
