/**
 * Admin API Route: /api/admin/deas/[id]/process-image
 * Processes a single image with crop/blur/arrow using Sharp (server-side)
 * Handles both:
 *   - Existing images: downloads original from S3, processes, uploads result
 *   - New images: receives base64, uploads original + processes, uploads result
 *
 * Requires ADMIN authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, extractExtension } from "@/lib/s3-utils";
import { processImage, downloadImage } from "@/lib/imageProcessing";
import type { CropData, ArrowData, BlurArea } from "@/types/shared";

interface ProcessImageBody {
  /** For existing images: ID of the AedImage record */
  imageId?: string;
  /** For new images: base64 data URL of the uploaded image */
  newImageDataUrl?: string;
  /** Image type (FRONT, LOCATION, ACCESS, SIGNAGE, CONTEXT, PLATE) */
  imageType?: string;
  /** Processing metadata from client-side components */
  cropData?: CropData;
  blurAreas?: BlurArea[];
  arrowData?: ArrowData;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);

    const { id: aedId } = await params;
    const body: ProcessImageBody = await request.json();
    const { imageId, newImageDataUrl, imageType, cropData, blurAreas, arrowData } = body;

    // Validate AED exists
    const aed = await prisma.aed.findUnique({
      where: { id: aedId },
      include: { images: true },
    });

    if (!aed) {
      return NextResponse.json({ success: false, error: "AED not found" }, { status: 404 });
    }

    let originalBuffer: Buffer;
    let originalUrl: string;
    let dbImageId: string;
    let extension = "jpg";
    const validTypes = ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"];
    const type = imageType && validTypes.includes(imageType) ? imageType : "FRONT";

    if (imageId) {
      // ── Process existing image ──
      const existingImage = aed.images.find((img) => img.id === imageId);
      if (!existingImage) {
        return NextResponse.json(
          { success: false, error: "Image not found on this AED" },
          { status: 404 }
        );
      }

      console.log(`🔄 Admin processing existing image ${imageId} for AED ${aedId}`);
      originalUrl = existingImage.original_url;
      dbImageId = imageId;
      extension = extractExtension(existingImage.original_url);

      // Download original
      originalBuffer = await downloadImage(originalUrl);
    } else if (newImageDataUrl) {
      // ── Process new upload ──
      const matches = newImageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { success: false, error: "Invalid image format. Expected data: URL" },
          { status: 400 }
        );
      }

      const contentType = matches[1];
      const base64Data = matches[2];
      originalBuffer = Buffer.from(base64Data, "base64");
      extension = contentType.includes("png") ? "png" : "jpg";

      console.log(`🔄 Admin processing new image upload for AED ${aedId}`);

      // Create AedImage record first to get an ID
      const newImage = await prisma.aedImage.create({
        data: {
          aed_id: aedId,
          type: type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
          order: aed.images.length + 1,
          original_url: "pending", // Will be updated below
          created_at: new Date(),
        },
      });

      dbImageId = newImage.id;

      // Upload original to S3
      const originalKey = buildImageKey(aedId, dbImageId, "original", extension);
      originalUrl = await uploadToS3({
        buffer: originalBuffer,
        filename: originalKey,
        contentType: contentType,
        prefix: aedId,
      });

      // Update the record with the real URL
      await prisma.aedImage.update({
        where: { id: dbImageId },
        data: { original_url: originalUrl },
      });

      console.log(`☁️ Original uploaded: ${originalUrl}`);
    } else {
      return NextResponse.json(
        { success: false, error: "Either imageId or newImageDataUrl is required" },
        { status: 400 }
      );
    }

    // ── Process image with Sharp ──
    const processedBuffer = await processImage({
      imageBuffer: originalBuffer,
      cropData,
      blurAreas: blurAreas && blurAreas.length > 0 ? blurAreas : undefined,
      arrowData,
    });

    // Upload processed image to S3
    const processedKey = buildImageKey(aedId, dbImageId, "processed", extension);
    const processedUrl = await uploadToS3({
      buffer: processedBuffer,
      filename: processedKey,
      contentType: "image/jpeg",
      prefix: aedId,
    });

    console.log(`☁️ Processed uploaded: ${processedUrl}`);

    // Update DB record with processed URL and verification info
    const updatedImage = await prisma.aedImage.update({
      where: { id: dbImageId },
      data: {
        original_url: originalUrl,
        processed_url: processedUrl,
        is_verified: true,
        verified_at: new Date(),
        verified_by: user.userId,
        type: type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
      },
    });

    // Record field change for audit
    await prisma.aedFieldChange.create({
      data: {
        aed_id: aedId,
        field_name: imageId ? "image_reprocessed" : "image_processed",
        old_value: imageId ? `${type} - original` : "",
        new_value: `${type} - procesada (crop${cropData ? "✓" : "✗"}, blur${blurAreas?.length ? "✓" : "✗"}, arrow${arrowData ? "✓" : "✗"})`,
        changed_by: user.userId,
        change_source: "WEB_UI",
      },
    });

    // Update AED verification date
    await prisma.aed.update({
      where: { id: aedId },
      data: {
        updated_by: user.userId,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Image ${dbImageId} processed successfully`);

    return NextResponse.json({
      success: true,
      data: {
        imageId: dbImageId,
        originalUrl: updatedImage.original_url,
        processedUrl: updatedImage.processed_url,
        type: updatedImage.type,
        isVerified: updatedImage.is_verified,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error processing image:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process image",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
