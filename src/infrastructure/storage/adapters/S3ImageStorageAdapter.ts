/**
 * Adapter de S3 para almacenamiento de imágenes
 * Capa de Infraestructura - Implementa IImageStorage
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import {
  IImageStorage,
  ImageUploadOptions,
  ImageUploadResult,
} from "@/domain/storage/ports/IImageStorage";
import { buildImageKey, buildS3Url, extractExtension } from "@/lib/s3-utils";

export class S3ImageStorageAdapter implements IImageStorage {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION || "eu-west-1";
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || "";

    if (!this.bucketName) {
      throw new Error("AWS_S3_BUCKET_NAME is not configured");
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
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

    await this.s3Client.send(command);

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

    await this.s3Client.send(command);
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
