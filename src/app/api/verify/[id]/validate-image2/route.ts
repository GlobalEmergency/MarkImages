import { NextRequest, NextResponse } from 'next/server';
import { verificationRepository } from '@/repositories/verificationRepository';
import { VerificationStatus, VerificationStep } from '@/types/verification';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const sessionId = parseInt(resolvedParams.id);
    const { isValid } = await request.json();

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

    if (!isValid) {
      // Si la imagen no es válida, marcar como incompleto y finalizar
      const updatedSession = await verificationRepository.update(sessionId, {
        status: VerificationStatus.CANCELLED,
        completedAt: new Date().toISOString()
      });

      return NextResponse.json({
        ...updatedSession,
        message: 'DEA marcado como incompleto debido a imagen inválida'
      });
    }

    // Si la imagen es válida, continuar al siguiente paso
    const updatedSession = await verificationRepository.update(sessionId, {
      currentStep: VerificationStep.IMAGE_CROP_2
    });

    return NextResponse.json(updatedSession);

  } catch (error) {
    console.error('Error validating second image:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
