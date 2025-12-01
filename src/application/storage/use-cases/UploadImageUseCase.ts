/**
 * Use Case: Subir imagen al sistema de almacenamiento
 * Capa de Aplicación - Orquesta la lógica de negocio
 */

import { IImageStorage } from "@/domain/storage/ports/IImageStorage";

export interface UploadImageRequest {
  file: File | Buffer;
  filename: string;
  contentType: string;
  prefix?: string;
  maxSizeBytes?: number;
}

export interface UploadImageResponse {
  url: string;
  key: string;
  size: number;
}

export class UploadImageUseCase {
  private readonly MAX_SIZE_DEFAULT = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  constructor(private readonly imageStorage: IImageStorage) {}

  async execute(request: UploadImageRequest): Promise<UploadImageResponse> {
    // 1. Validar tipo de contenido
    if (!this.ALLOWED_TYPES.includes(request.contentType)) {
      throw new Error(
        `Tipo de archivo no válido. Solo se permiten: ${this.ALLOWED_TYPES.join(", ")}`
      );
    }

    // 2. Convertir File a Buffer si es necesario
    const buffer = await this.toBuffer(request.file);

    // 3. Validar tamaño
    const maxSize = request.maxSizeBytes || this.MAX_SIZE_DEFAULT;
    if (buffer.length > maxSize) {
      throw new Error(
        `El archivo es demasiado grande. Máximo ${maxSize / 1024 / 1024}MB.`
      );
    }

    // 4. Subir a storage
    const result = await this.imageStorage.upload({
      buffer,
      filename: request.filename,
      contentType: request.contentType,
      prefix: request.prefix,
    });

    return result;
  }

  private async toBuffer(file: File | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }

    // Si es File (del navegador)
    return Buffer.from(await file.arrayBuffer());
  }
}
