import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, extractExtension } from "@/lib/s3-utils";
import { processVerificationImages, type ImageToProcess } from "@/lib/imageProcessing";
import { validateStatusTransition } from "@/lib/aed-status";
import { recordStatusChange } from "@/lib/audit";
import type { ProcessedImageData } from "@/types/verification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
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

    // Validate status transition via state machine
    const previousStatus = validation.aed.status;
    if (previousStatus !== "PUBLISHED") {
      try {
        validateStatusTransition(previousStatus, "PUBLISHED");
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: `No se puede publicar un DEA en estado ${previousStatus} mediante verificación.`,
          },
          { status: 400 }
        );
      }
    }

    console.log("🔄 Iniciando procesamiento de imágenes...");

    // Extraer datos de procesamiento
    const validationData = validation.data as any;
    const processedImages: ProcessedImageData[] = validationData?.processed_images || [];

    console.log(`📋 Imágenes a procesar: ${processedImages.length}`);

    // Procesar cada imagen
    const imagesToProcess: ImageToProcess[] = [];

    for (const processedImg of processedImages) {
      // Buscar la imagen en la BD
      const imageRecord = validation.aed.images.find((img) => img.id === processedImg.image_id);

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

    // Procesar todas las imágenes (CPU/network — done outside transaction)
    const processedBuffers = await processVerificationImages(imagesToProcess);

    console.log(`✅ ${processedBuffers.size} imágenes procesadas`);

    // ── Upload images to S3 (network I/O — outside transaction) ──────
    const imageUpdates: Array<{
      imageId: string;
      newOriginalUrl: string;
      processedUrl: string;
    }> = [];

    for (const [imageId, processedBuffer] of processedBuffers) {
      const imageRecord = validation.aed.images.find((img) => img.id === imageId);
      if (!imageRecord) continue;

      const extension = extractExtension(imageRecord.original_url);

      console.log(`☁️ Descargando y re-subiendo imagen original ${imageId}...`);

      // Descargar imagen original
      const originalResponse = await fetch(imageRecord.original_url);
      if (!originalResponse.ok) {
        throw new Error(`Failed to download original image: ${originalResponse.statusText}`);
      }
      const originalArrayBuffer = await originalResponse.arrayBuffer();
      const originalBuffer = Buffer.from(originalArrayBuffer);

      // Subir imagen original a S3 con formato estructurado
      const originalKey = buildImageKey(id, imageId, "original", extension);
      const newOriginalUrl = await uploadToS3({
        buffer: originalBuffer,
        filename: originalKey,
        contentType: imageRecord.original_url.includes(".png") ? "image/png" : "image/jpeg",
        prefix: id,
      });

      console.log(`✅ Imagen original ${imageId} re-subida: ${newOriginalUrl}`);

      // Subir imagen procesada
      const processedKey = buildImageKey(id, imageId, "processed", extension);
      console.log(`☁️ Subiendo imagen procesada ${imageId} a S3...`);
      const processedUrl = await uploadToS3({
        buffer: processedBuffer,
        filename: processedKey,
        contentType: "image/jpeg",
        prefix: id,
      });

      console.log(`✅ Imagen ${imageId} subida: ${processedUrl}`);

      imageUpdates.push({ imageId, newOriginalUrl, processedUrl });
    }

    // ── Wrap all DB writes in a single transaction ───────────────────
    const now = new Date();

    const updatedValidation = await prisma.$transaction(async (tx) => {
      // 1. Update all image records
      for (const { imageId, newOriginalUrl, processedUrl } of imageUpdates) {
        await tx.aedImage.update({
          where: { id: imageId },
          data: {
            original_url: newOriginalUrl,
            processed_url: processedUrl,
            is_verified: true,
            verified_at: now,
            verified_by: user.userId,
          },
        });
      }

      // 2. Update validation status to COMPLETED
      const completedValidation = await tx.aedValidation.update({
        where: { id: validation.id },
        data: {
          status: "COMPLETED",
          completed_at: now,
          result: {
            completed_by: user.userId,
            completed_at: now,
            processed_images_count: processedBuffers.size,
          },
        },
      });

      // 3. Update AED status to PUBLISHED with verification data
      await tx.aed.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          published_at: validation.aed.published_at || now,
          last_verified_at: now,
          verification_method: "photo_verification",
          requires_attention: false,
          updated_by: user.userId,
          updated_at: now,
        },
      });

      // 4. Record status change in audit trail
      if (previousStatus !== "PUBLISHED") {
        await recordStatusChange(tx, {
          aedId: id,
          previousStatus,
          newStatus: "PUBLISHED",
          modifiedBy: user.userId,
          reason: "Verificación fotográfica completada",
          notes: `${processedBuffers.size} imagen(es) procesada(s). Dirección ${validationData?.validated_address ? "validada" : "no validada"}.`,
        });
      }

      // 5. Create AedOrganizationVerification
      // Find the user's organization (prefer the one that has this AED assigned)
      const userAssignment = await tx.aedOrganizationAssignment.findFirst({
        where: {
          aed_id: id,
          organization: {
            members: { some: { user_id: user.userId } },
          },
        },
        select: { organization_id: true },
      });

      // Fallback: use any organization the user belongs to
      const orgId =
        userAssignment?.organization_id ||
        (
          await tx.organizationMember.findFirst({
            where: { user_id: user.userId },
            select: { organization_id: true },
          })
        )?.organization_id;

      if (orgId) {
        // Mark previous verifications as superseded
        await tx.aedOrganizationVerification.updateMany({
          where: { aed_id: id, organization_id: orgId, is_current: true },
          data: { is_current: false, superseded_at: now },
        });

        await tx.aedOrganizationVerification.create({
          data: {
            aed_id: id,
            organization_id: orgId,
            verification_type: "FIELD_INSPECTION",
            verified_by: user.userId,
            verified_at: now,
            verified_photos: true,
            verified_address: !!validationData?.validated_address,
            verified_access: false,
            verified_schedule: false,
            verified_signage: false,
            is_current: true,
            notes: `Verificación fotográfica completada. ${processedBuffers.size} imagen(es) procesada(s).`,
          },
        });
      }

      return completedValidation;
    });

    console.log("🎉 Verificación completada exitosamente");

    return NextResponse.json(updatedValidation);
  } catch (error) {
    console.error("Error completing verification:", error);
    return NextResponse.json(
      {
        error: "Error al completar verificación",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
