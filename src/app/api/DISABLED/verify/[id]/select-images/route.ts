import { NextRequest, NextResponse } from 'next/server';
import { VerificationStep, VerificationStatus, VerificationSession } from '@/types/verification';
import { verificationRepository } from '@/repositories/verificationRepository';
import { DeaRepository } from '@/repositories/deaRepository';

const deaRepository = new DeaRepository();

interface SelectImagesRequest {
  image1Valid: boolean;
  image2Valid: boolean;
  imagesSwapped: boolean;
  markedAsInvalid: boolean;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body: SelectImagesRequest = await request.json();
    const { image1Valid, image2Valid, imagesSwapped, markedAsInvalid } = body;

    // Buscar la sesión
    const session = await verificationRepository.findById(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión de verificación no encontrada' },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const updateData: Partial<VerificationSession> = {
      image1Valid,
      image2Valid,
      imagesSwapped,
      markedAsInvalid,
    };

    // Si hay swap, intercambiar las URLs
    if (imagesSwapped && session.originalImageUrl && session.secondImageUrl) {
      updateData.originalImageUrl = session.secondImageUrl;
      updateData.secondImageUrl = session.originalImageUrl;
    }

    // Determinar el siguiente paso basado en la selección
    if (markedAsInvalid) {
      // Si está marcado como inválido, ir directo a completado
      updateData.currentStep = VerificationStep.COMPLETED;
      updateData.status = VerificationStatus.VERIFIED;
      updateData.completedAt = new Date().toISOString();
      
      // Actualizar el estado de verificación de datos del DEA
      await deaRepository.update(session.deaRecordId, {
        imageVerificationStatus: 'invalid'
      });
      console.log(`✅ DEA ${session.deaRecordId} marcado como inválido (markedAsInvalid)`);
    } else if (image1Valid && !image2Valid) {
      // Solo imagen 1 válida -> crop imagen 1
      updateData.currentStep = VerificationStep.IMAGE_CROP_1;
    } else if (!image1Valid && image2Valid) {
      // Solo imagen 2 válida -> crop imagen 2
      updateData.currentStep = VerificationStep.IMAGE_CROP_2;
    } else if (image1Valid && image2Valid) {
      // Ambas válidas -> crop imagen 1 (después vendrá imagen 2)
      updateData.currentStep = VerificationStep.IMAGE_CROP_1;
    } else {
      // Ninguna válida (no debería pasar, pero por si acaso)
      updateData.currentStep = VerificationStep.COMPLETED;
      updateData.status = VerificationStatus.VERIFIED;
      updateData.markedAsInvalid = true;
      updateData.completedAt = new Date().toISOString();
      
      // Actualizar el estado de verificación de datos del DEA
      await deaRepository.update(session.deaRecordId, {
        imageVerificationStatus: 'invalid'
      });
      console.log(`✅ DEA ${session.deaRecordId} marcado como inválido (ninguna imagen válida)`);
    }

    // Actualizar la sesión usando el repositorio
    const updatedSession = await verificationRepository.update(id, updateData);

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error selecting images:', error);
    return NextResponse.json(
      { error: 'Error al procesar selección de imágenes' },
      { status: 500 }
    );
  }
}
