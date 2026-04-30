/**
 * Adapter de S3 para almacenamiento de imágenes
 * Capa de Infraestructura - Implementa IImageStorage
 *
 * Uses the shared S3Client singleton from @/lib/s3 to avoid
 * creating multiple client instances.
 */

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import {
  IImageStorage,
  ImageUploadOptions,
  ImageUploadResult,
} from "@/storage/domain/ports/IImageStorage";
import { buildImageKey, buildS3Url, extractExtension } from "@/lib/s3-utils";
import { getS3Client, getS3BucketName, getS3Region } from "@/lib/s3";

export class S3ImageStorageAdapter implements IImageStorage {
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.region = getS3Region();
    this.bucketName = getS3BucketName();
  }

  async upload(options: ImageUploadOptions): Promise<ImageUploadResult> {
    const {
      buffer,
      filename,
      contentType,
      prefix = "dea-foto",
      metadata,
      aedId,
      imageId,
      variant = "original",
    } = options;

    let key: string;

    // New structure: /AEDID/IMAGEID_variant_hash.ext
    if (aedId && imageId) {
      const extension = extractExtension(filename);
      key = buildImageKey(aedId, imageId, variant, extension);
    }
    // Backward compatibility: Legacy structure
    else {
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      key = `${prefix}/${timestamp}-${sanitizedFilename}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
      Metadata: metadata,
    });

    await getS3Client().send(command);

    const url = buildS3Url(this.bucketName, this.region, key);

    return {
      url,
      key,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await getS3Client().send(command);
  }

  getPublicUrl(key: string): string {
    return buildS3Url(this.bucketName, this.region, key);
  }
}
