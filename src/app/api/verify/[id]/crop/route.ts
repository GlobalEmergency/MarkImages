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
    const { imageUrl, cropData } = await request.json();
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' }, 
        { status: 400 }
      );
    }

    if (!imageUrl || !cropData) {
      return NextResponse.json(
        { error: 'URL de imagen y datos de recorte son requeridos' }, 
        { status: 400 }
      );
    }

    // Validar datos de recorte
    const { x, y, width, height } = cropData;
    if (typeof x !== 'number' || typeof y !== 'number' || 
        typeof width !== 'number' || typeof height !== 'number') {
      return NextResponse.json(
        { error: 'Datos de recorte inválidos' }, 
        { status: 400 }
      );
    }

    const updatedSession = await verificationService.saveCroppedImage(
      sessionId, 
      imageUrl, 
      cropData
    );

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error processing cropped image:', error);
    return NextResponse.json(
      { error: 'Error al procesar imagen recortada' }, 
      { status: 500 }
    );
  }
}
