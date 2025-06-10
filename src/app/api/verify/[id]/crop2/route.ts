import { NextRequest, NextResponse } from 'next/server';
import { verificationRepository } from '@/repositories/verificationRepository';
import { ServerImageProcessingService } from '@/services/serverImageProcessingService';
import { VerificationStep } from '@/types/verification';
import type { CropData } from '@/types/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const sessionId = parseInt(resolvedParams.id);
    const { imageUrl, cropData }: { imageUrl: string; cropData: CropData } = await request.json();

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'ID de sesión inválido' },
        { status: 400 }
      );
    }

    // Obtener la sesión actual
    const session = await verificationRepository.findById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    // Procesar la imagen recortada
    const result = await ServerImageProcessingService.cropImage(
      imageUrl,
      cropData,
      {
        aspectRatio: 1,
        outputSize: { width: 1000, height: 1000 }
      }
    );

    // Actualizar la sesión con la imagen recortada
    const updatedSession = await verificationRepository.update(sessionId, {
      secondCroppedImageUrl: result.imageUrl,
      currentStep: VerificationStep.ARROW_PLACEMENT_2
    });

    return NextResponse.json(updatedSession);

  } catch (error) {
    console.error('Error cropping second image:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
