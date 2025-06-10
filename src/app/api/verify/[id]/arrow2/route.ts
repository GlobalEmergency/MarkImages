import { NextRequest, NextResponse } from 'next/server';
import { verificationRepository } from '@/repositories/verificationRepository';
import { arrowMarkerRepository } from '@/repositories/arrowMarkerRepository';
import { ServerImageProcessingService } from '@/services/serverImageProcessingService';
import { VerificationStep } from '@/types/verification';
import { ARROW_CONFIG } from '@/utils/arrowConstants';
import type { ArrowData } from '@/types/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const sessionId = parseInt(resolvedParams.id);
    const { arrowData }: { arrowData: ArrowData } = await request.json();

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

    if (!session.secondCroppedImageUrl) {
      return NextResponse.json(
        { error: 'No hay imagen recortada disponible' },
        { status: 400 }
      );
    }

    // Guardar el marcador de flecha en la base de datos
    await arrowMarkerRepository.create({
      verificationSessionId: sessionId,
      imageNumber: 2, // Segunda imagen
      startX: arrowData.startX,
      startY: arrowData.startY,
      endX: arrowData.endX,
      endY: arrowData.endY,
      arrowColor: arrowData.color,
      arrowWidth: arrowData.width
    });

    // Procesar la imagen con la flecha usando las constantes estandarizadas
    const result = await ServerImageProcessingService.addArrow(
      session.secondCroppedImageUrl,
      [arrowData],
      {
        startPosition: 'custom',
        color: ARROW_CONFIG.COLOR,
        width: ARROW_CONFIG.BODY_WIDTH,
        headLength: ARROW_CONFIG.HEAD_LENGTH,
        headWidth: ARROW_CONFIG.BODY_WIDTH,
        allowMultiple: false
      }
    );

    // Actualizar la sesión con la imagen procesada
    const updatedSession = await verificationRepository.update(sessionId, {
      secondProcessedImageUrl: result.imageUrl,
      currentStep: VerificationStep.REVIEW
    });

    return NextResponse.json(updatedSession);

  } catch (error) {
    console.error('Error adding arrow to second image:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
