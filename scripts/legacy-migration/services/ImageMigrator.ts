/**
 * Image Migrator Service
 * Downloads images from legacy sources and uploads to new S3 bucket
 * Infrastructure Layer - Adapter
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import sharp from "sharp";
import type { LegacyDeaRecord, LegacyVerificationSession, ImageData } from "../types";
import {
  buildImageKey,
  buildS3Url,
  extractExtension,
  type ImageVariant,
} from "../../../src/lib/s3-utils";

export interface ImageMigrationResult {
  original_url: string;
  processed_url: string | null;
}

interface ImageMetadata {
  width: number | null;
  height: number | null;
  size_bytes: number;
  format: string;
}

export class ImageMigrator {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private maxRetries = 3;
  private timeout = 30000; // 30 seconds

  constructor(bucket: string, region: string, accessKeyId: string, secretAccessKey: string) {
    this.bucket = bucket;
    this.region = region;
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Migrate both images (FRONT and LOCATION) for a DEA record
   * @param aedId - UUID of the AED in the new system
   * @param legacyRecord - Legacy DEA record from old database
   * @param verificationSession - Verification session data (if exists)
   */
  async migrateImages(
    aedId: string,
    legacyRecord: LegacyDeaRecord,
    verificationSession: LegacyVerificationSession | null
  ): Promise<ImageData[]> {
    const images: ImageData[] = [];

    // Migrate Image 1 (FRONT)
    const image1 = await this.migrateImagePair(
      aedId,
      legacyRecord.id,
      "FRONT",
      1,
      legacyRecord.foto1,
      verificationSession?.original_image_url || null,
      verificationSession?.processed_image_url || null,
      verificationSession?.status || null,
      verificationSession?.completed_at || null
    );
    if (image1) images.push(image1);

    // Migrate Image 2 (LOCATION)
    const image2 = await this.migrateImagePair(
      aedId,
      legacyRecord.id,
      "LOCATION",
      2,
      legacyRecord.foto2,
      verificationSession?.second_image_url || null,
      verificationSession?.second_processed_image_url || null,
      verificationSession?.status || null,
      verificationSession?.completed_at || null
    );
    if (image2) images.push(image2);

    return images;
  }

  /**
   * Migrate a pair of images (original + processed)
   * New structure: /AEDID/IMAGEID_original_HASH.ext and /AEDID/IMAGEID.ext
   */
  private async migrateImagePair(
    aedId: string,
    legacyDeaId: number,
    type: "FRONT" | "LOCATION",
    order: number,
    fotoUrl: string | null,
    originalUrl: string | null,
    processedUrl: string | null,
    verificationStatus: string | null,
    completedAt: string | null
  ): Promise<ImageData | null> {
    // Determine which URL to use for original
    // Priority: base64 from dea_records (foto1/foto2) first, then verification_sessions URLs
    const sourceOriginalUrl = fotoUrl || originalUrl;

    if (!sourceOriginalUrl) {
      console.warn(`  ⚠️  No image source for DEA ${legacyDeaId} ${type}`);
      return null;
    }

    try {
      // Generate unique image ID for this image
      const imageId = randomUUID();

      // Migrate original image and get metadata
      const { url: newOriginalUrl, metadata: originalMetadata } =
        await this.downloadAndUploadWithMetadata(aedId, imageId, sourceOriginalUrl, "original");

      // Migrate processed image (if exists)
      let newProcessedUrl: string | null = null;
      if (processedUrl) {
        try {
          const result = await this.downloadAndUploadWithMetadata(
            aedId,
            imageId,
            processedUrl,
            "processed"
          );
          newProcessedUrl = result.url;
        } catch (error) {
          console.warn(`  ⚠️  Failed to migrate processed image: ${error}`);
          // Continue without processed image
        }
      }

      // Determine if image is verified
      const isVerified = verificationStatus === "verified" && !!newProcessedUrl;

      return {
        type,
        order,
        original_url: newOriginalUrl,
        processed_url: newProcessedUrl,
        width: originalMetadata.width,
        height: originalMetadata.height,
        size_bytes: originalMetadata.size_bytes,
        format: originalMetadata.format,
        is_verified: isVerified,
        verified_at: completedAt ? new Date(completedAt) : null,
      };
    } catch (error) {
      console.error(`  ❌ Failed to migrate ${type} image for DEA ${legacyDeaId}:`, error);
      throw error;
    }
  }

  /**
   * Download image, extract metadata, and upload to S3 bucket
   * New structure: /AEDID/IMAGEID_original_HASH.ext or /AEDID/IMAGEID.ext
   */
  private async downloadAndUploadWithMetadata(
    aedId: string,
    imageId: string,
    sourceUrl: string,
    variant: ImageVariant
  ): Promise<{ url: string; metadata: ImageMetadata }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Download image
        const buffer = await this.downloadImage(sourceUrl);

        // Extract metadata
        const metadata = await this.getImageMetadata(buffer);

        // Extract extension from source
        const extension = extractExtension(sourceUrl);

        // Build S3 key with new structure
        const s3Key = buildImageKey(aedId, imageId, variant, extension);

        // Upload to S3
        await this.uploadToS3(buffer, s3Key);

        // Return public URL and metadata
        const publicUrl = buildS3Url(this.bucket, this.region, s3Key);

        if (attempt > 1) {
          console.log(`    ✅ Success on attempt ${attempt}`);
        }

        return { url: publicUrl, metadata };
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          const delay = attempt * 1000; // Exponential backoff
          console.warn(`    ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to migrate image after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Download image from URL with timeout
   * Supports both HTTP URLs and base64 data URIs
   */
  private async downloadImage(url: string): Promise<Buffer> {
    // Check if it's a base64 data URI
    if (url.startsWith("data:image/")) {
      try {
        // Extract base64 data after the comma
        const base64Data = url.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 data URI format");
        }
        return Buffer.from(base64Data, "base64");
      } catch (error) {
        throw new Error(
          `Failed to decode base64 image: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Download from HTTP URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Download timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract image metadata using sharp
   */
  private async getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width || null,
        height: metadata.height || null,
        size_bytes: buffer.length,
        format: metadata.format || "jpeg",
      };
    } catch (error) {
      console.warn(`  ⚠️  Failed to extract metadata: ${error}`);
      return {
        width: null,
        height: null,
        size_bytes: buffer.length,
        format: "jpeg",
      };
    }
  }

  /**
   * Upload buffer to S3
   */
  private async uploadToS3(buffer: Buffer, key: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000", // Cache for 1 year
    });

    await this.s3Client.send(command);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close S3 client
   */
  async close(): Promise<void> {
    this.s3Client.destroy();
  }
}
