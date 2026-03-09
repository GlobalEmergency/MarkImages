/**
 * Admin API Route: /api/admin/deas/[id]/process-image
 * Processes a single image with crop/blur/arrow using Sharp (server-side)
 * Handles both:
 *   - Existing images: downloads original from S3, processes, uploads result
 *   - New images: receives base64, uploads original + processes, uploads result
 *
 * Requires ADMIN authentication or org-level can_edit permission
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrAedPermission, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, extractExtension } from "@/lib/s3-utils";
import { processImage, downloadImage } from "@/lib/imageProcessing";
import { recordFieldChange } from "@/lib/audit";
import type { CropData, ArrowData, BlurArea } from "@/types/shared";

interface ProcessImageBody {
  /** For existing images: ID of the AedImage record */
  imageId?: string;
  /** For new images: base64 data URL of the uploaded image */
  newImageDataUrl?: string;
  /** For new images: S3 URL of the pre-uploaded original image (avoids 413 on large payloads) */
  newImageUrl?: string;
  /** Image type (FRONT, LOCATION, ACCESS, SIGNAGE, CONTEXT, PLATE) */
  imageType?: string;
  /** Processing metadata from client-side components */
  cropData?: CropData;
  blurAreas?: BlurArea[];
  arrowData?: ArrowData;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: aedId } = await params;
    const { user } = await requireAdminOrAedPermission(request, aedId, "can_edit");
    const body: ProcessImageBody = await request.json();
    const { imageId, newImageDataUrl, newImageUrl, imageType, cropData, blurAreas, arrowData } =
      body;

    // Validate AED exists
    const aed = await prisma.aed.findUnique({
      where: { id: aedId },
      include: { images: true },
    });

    if (!aed) {
      return NextResponse.json({ success: false, error: "AED not found" }, { status: 404 });
    }

    let originalBuffer: Buffer;
    let extension = "jpg";
    const validTypes = ["FRONT", "LOCATION", "ACCESS", "SIGNAGE", "CONTEXT", "PLATE"];
    const type = imageType && validTypes.includes(imageType) ? imageType : "FRONT";

    // ── Phase 1: Resolve original image (network I/O, outside transaction) ──
    let isNewImage = false;
    let existingDbImageId: string | undefined;
    let newImageContentType = "image/jpeg";

    if (imageId) {
      // Process existing image
      const existingImage = aed.images.find((img) => img.id === imageId);
      if (!existingImage) {
        return NextResponse.json(
          { success: false, error: "Image not found on this AED" },
          { status: 404 }
        );
      }

      console.log(`🔄 Admin processing existing image ${imageId} for AED ${aedId}`);
      existingDbImageId = imageId;
      extension = extractExtension(existingImage.original_url);
      originalBuffer = await downloadImage(existingImage.original_url);
    } else if (newImageDataUrl) {
      // Process new upload
      const matches = newImageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { success: false, error: "Invalid image format. Expected data: URL" },
          { status: 400 }
        );
      }

      newImageContentType = matches[1];
      const base64Data = matches[2];
      originalBuffer = Buffer.from(base64Data, "base64");
      extension = newImageContentType.includes("png") ? "png" : "jpg";
      isNewImage = true;

      console.log(`🔄 Admin processing new image upload for AED ${aedId}`);
    } else if (newImageUrl) {
      // Download pre-uploaded image from S3 URL
      originalBuffer = await downloadImage(newImageUrl);
      extension = extractExtension(newImageUrl) || "jpg";
      newImageContentType = extension === "png" ? "image/png" : "image/jpeg";
      isNewImage = true;

      console.log(`🔄 Admin processing new image from URL for AED ${aedId}`);
    } else {
      return NextResponse.json(
        { success: false, error: "Either imageId, newImageDataUrl, or newImageUrl is required" },
        { status: 400 }
      );
    }

    // ── Phase 2: Process image with Sharp (CPU, outside transaction) ──
    const processedBuffer = await processImage({
      imageBuffer: originalBuffer,
      cropData,
      blurAreas: blurAreas && blurAreas.length > 0 ? blurAreas : undefined,
      arrowData,
    });

    // ── Phase 3: Upload to S3 (network I/O, outside transaction) ──
    // For new images we need a DB record to get an ID for the S3 key.
    // Create a temporary record, then do S3 uploads, then finalize in transaction.
    let dbImageId: string;
    let originalUrl: string;

    if (isNewImage) {
      // Create minimal record to get an ID for S3 key
      const tempImage = await prisma.aedImage.create({
        data: {
          aed_id: aedId,
          type: type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
          order: aed.images.length + 1,
          original_url: "pending",
          created_at: new Date(),
        },
      });
      dbImageId = tempImage.id;

      // Upload original to S3
      const originalKey = buildImageKey(aedId, dbImageId, "original", extension);
      originalUrl = await uploadToS3({
        buffer: originalBuffer,
        filename: originalKey,
        contentType: newImageContentType,
        prefix: aedId,
      });
      console.log(`☁️ Original uploaded: ${originalUrl}`);
    } else {
      dbImageId = existingDbImageId!;
      const existingImage = aed.images.find((img) => img.id === imageId)!;
      originalUrl = existingImage.original_url;
    }

    // Upload processed image to S3
    const processedKey = buildImageKey(aedId, dbImageId, "processed", extension);
    const processedUrl = await uploadToS3({
      buffer: processedBuffer,
      filename: processedKey,
      contentType: "image/jpeg",
      prefix: aedId,
    });
    console.log(`☁️ Processed uploaded: ${processedUrl}`);

    // ── Phase 4: All DB writes in a single transaction ──
    const now = new Date();

    const updatedImage = await prisma.$transaction(async (tx) => {
      // 1. Update image record with final URLs and verification
      const image = await tx.aedImage.update({
        where: { id: dbImageId },
        data: {
          original_url: originalUrl,
          processed_url: processedUrl,
          is_verified: true,
          verified_at: now,
          verified_by: user.userId,
          type: type as "FRONT" | "LOCATION" | "ACCESS" | "SIGNAGE" | "CONTEXT" | "PLATE",
        },
      });

      // 2. Record field change for audit
      await recordFieldChange(tx, {
        aedId,
        fieldName: imageId ? "image_reprocessed" : "image_processed",
        oldValue: imageId ? `${type} - original` : "",
        newValue: `${type} - procesada (crop${cropData ? "✓" : "✗"}, blur${blurAreas?.length ? "✓" : "✗"}, arrow${arrowData ? "✓" : "✗"})`,
        changedBy: user.userId,
        changeSource: "WEB_UI",
      });

      // 3. Update AED timestamp
      await tx.aed.update({
        where: { id: aedId },
        data: {
          updated_by: user.userId,
          updated_at: now,
        },
      });

      return image;
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
