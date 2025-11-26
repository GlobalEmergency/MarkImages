import { NextRequest, NextResponse } from 'next/server';
import { VerificationStep } from '@/types/verification';
import { verificationRepository } from '@/repositories/verificationRepository';

interface UploadImagesRequest {
  image1Url?: string;
  image2Url?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body: UploadImagesRequest = await request.json();
    const { image1Url, image2Url } = body;

    // Validar que al menos una imagen fue proporcionada
    if (!image1Url && !image2Url) {
      return NextResponse.json(
        { error: 'Debe proporcionar al menos una imagen' },
        { status: 400 }
      );
    }

    // Buscar la sesión
    const session = await verificationRepository.findById(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión de verificación no encontrada' },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const updateData: {
      originalImageUrl?: string;
      secondImageUrl?: string;
      image1Valid: boolean;
      image2Valid: boolean;
      imagesSwapped: boolean;
      markedAsInvalid: boolean;
      currentStep: VerificationStep;
    } = {
      image1Valid: !!image1Url,
      image2Valid: !!image2Url,
      imagesSwapped: false,
      markedAsInvalid: false,
      currentStep: VerificationStep.IMAGE_CROP_1
    };

    // Actualizar las URLs de las imágenes
    if (image1Url) {
      updateData.originalImageUrl = image1Url;
    }
    if (image2Url) {
      updateData.secondImageUrl = image2Url;
    }

    // Determinar el siguiente paso basado en qué imágenes se subieron
    if (image1Url && !image2Url) {
      // Solo imagen 1 -> crop imagen 1
      updateData.currentStep = VerificationStep.IMAGE_CROP_1;
    } else if (!image1Url && image2Url) {
      // Solo imagen 2 -> crop imagen 2
      updateData.currentStep = VerificationStep.IMAGE_CROP_2;
    } else if (image1Url && image2Url) {
      // Ambas imágenes -> empezar con crop imagen 1
      updateData.currentStep = VerificationStep.IMAGE_CROP_1;
    }

    // Actualizar la sesión usando el repositorio
    const updatedSession = await verificationRepository.update(id, updateData);

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error uploading new images:', error);
    return NextResponse.json(
      { error: 'Error al subir nuevas imágenes' },
      { status: 500 }
    );
  }
}
