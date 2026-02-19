import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, extractExtension } from "@/lib/s3-utils";
import { processVerificationImages, type ImageToProcess } from "@/lib/imageProcessing";
import type { ProcessedImageData } from "@/types/verification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Find the active validation
    const validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
      include: {
        aed: {
          include: {
            images: true,
          },
        },
      },
    });

    if (!validation) {
      return NextResponse.json({ error: "Sesión de verificación no encontrada" }, { status: 404 });
    }

    console.log('🔄 Iniciando procesamiento de imágenes...');

    // Extraer datos de procesamiento
    const validationData = validation.data as any;
    const processedImages: ProcessedImageData[] = validationData?.processed_images || [];

    console.log(`📋 Imágenes a procesar: ${processedImages.length}`);

    // Procesar cada imagen
    const imagesToProcess: ImageToProcess[] = [];

    for (const processedImg of processedImages) {
      // Buscar la imagen en la BD
      const imageRecord = validation.aed.images.find(img => img.id === processedImg.image_id);

      if (!imageRecord) {
        console.warn(`⚠️ Imagen ${processedImg.image_id} no encontrada en BD`);
        continue;
      }

      imagesToProcess.push({
        imageId: processedImg.image_id,
        originalUrl: imageRecord.original_url,
        cropData: processedImg.crop_data,
        blurAreas: processedImg.blur_areas,
        arrowData: processedImg.arrow_data,
      });
    }

    // Procesar todas las imágenes
    const processedBuffers = await processVerificationImages(imagesToProcess);

    console.log(`✅ ${processedBuffers.size} imágenes procesadas`);

    // Subir imágenes (originales y procesadas) a S3 y actualizar BD
    for (const [imageId, processedBuffer] of processedBuffers) {
      const imageRecord = validation.aed.images.find(img => img.id === imageId);
      if (!imageRecord) continue;

      const extension = extractExtension(imageRecord.original_url);

      // 1. Re-subir imagen original con formato estructurado correcto
      console.log(`☁️ Descargando y re-subiendo imagen original ${imageId}...`);
      try {
        // Descargar imagen original
        const originalResponse = await fetch(imageRecord.original_url);
        if (!originalResponse.ok) {
          throw new Error(`Failed to download original image: ${originalResponse.statusText}`);
        }
        const originalArrayBuffer = await originalResponse.arrayBuffer();
        const originalBuffer = Buffer.from(originalArrayBuffer);

        // Generar key para imagen original con formato correcto
        const originalKey = buildImageKey(id, imageId, 'original', extension);

        // Subir imagen original a S3 con formato estructurado
        const newOriginalUrl = await uploadToS3({
          buffer: originalBuffer,
          filename: originalKey,
          contentType: imageRecord.original_url.includes('.png') ? 'image/png' : 'image/jpeg',
          prefix: id,
        });

        console.log(`✅ Imagen original ${imageId} re-subida: ${newOriginalUrl}`);

        // 2. Subir imagen procesada
        const processedKey = buildImageKey(id, imageId, 'processed', extension);

        console.log(`☁️ Subiendo imagen procesada ${imageId} a S3...`);
        const processedUrl = await uploadToS3({
          buffer: processedBuffer,
          filename: processedKey,
          contentType: 'image/jpeg',
          prefix: id,
        });

        // 3. Actualizar registro de imagen con ambas URLs y verificación
        await prisma.aedImage.update({
          where: { id: imageId },
          data: {
            original_url: newOriginalUrl,
            processed_url: processedUrl,
            is_verified: true,
            verified_at: new Date(),
            verified_by: user.userId,
          },
        });

        console.log(`✅ Imagen ${imageId} guardada y verificada - Original: ${newOriginalUrl}, Procesada: ${processedUrl}`);
      } catch (error) {
        console.error(`❌ Error procesando imagen ${imageId}:`, error);
        // Continue with other images even if one fails
        throw error; // Re-throw to rollback transaction
      }
    }

    // Update validation status to COMPLETED
    const updatedValidation = await prisma.aedValidation.update({
      where: { id: validation.id },
      data: {
        status: "COMPLETED",
        completed_at: new Date(),
        result: {
          completed_by: user.userId,
          completed_at: new Date(),
          processed_images_count: processedBuffers.size,
        },
      },
    });

    // Update AED status to PUBLISHED with verification data
    const now = new Date();
    await prisma.aed.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        published_at: validation.aed.published_at || now, // Keep existing if already published
        last_verified_at: now,
        verification_method: "photo_verification",
        updated_by: user.userId,
        updated_at: now,
      },
    });

    // ── Create AedOrganizationVerification so it appears in admin detail ──
    // Find the user's organization (prefer the one that has this AED assigned)
    const userAssignment = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        aed_id: id,
        organization: {
          members: { some: { user_id: user.userId } },
        },
      },
      select: { organization_id: true },
    });

    // Fallback: use any organization the user belongs to
    const orgId = userAssignment?.organization_id
      || (await prisma.organizationMember.findFirst({
           where: { user_id: user.userId },
           select: { organization_id: true },
         }))?.organization_id;

    if (orgId) {
      // Mark any previous verification for this AED+org as superseded
      await prisma.aedOrganizationVerification.updateMany({
        where: { aed_id: id, organization_id: orgId, is_current: true },
        data: { is_current: false, superseded_at: now },
      });

      await prisma.aedOrganizationVerification.create({
        data: {
          aed_id: id,
          organization_id: orgId,
          verification_type: "FIELD_INSPECTION",
          verified_by: user.userId,
          verified_at: now,
          verified_photos: true,
          verified_address: !!(validationData?.validated_address),
          verified_access: false,
          verified_schedule: false,
          verified_signage: false,
          is_current: true,
          notes: `Verificación fotográfica completada. ${processedBuffers.size} imagen(es) procesada(s).`,
        },
      });
    }

    console.log('🎉 Verificación completada exitosamente');

    return NextResponse.json(updatedValidation);
  } catch (error) {
    console.error("Error completing verification:", error);
    return NextResponse.json({
      error: "Error al completar verificación",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
