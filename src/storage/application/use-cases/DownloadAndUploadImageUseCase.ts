/**
 * Use Case: Descargar imagen desde URL externa y subirla a S3
 * Capa de Aplicación - Orquesta la lógica de negocio
 */

import { IImageDownloader, SharePointAuthConfig } from "@/storage/domain/ports/IImageDownloader";
import { IImageStorage } from "@/storage/domain/ports/IImageStorage";

export interface DownloadAndUploadImageRequest {
  url: string;
  aedId: string;
  imageId: string;
  sharePointAuth?: SharePointAuthConfig;
  timeoutMs?: number;
  maxSizeBytes?: number;
}

export interface DownloadAndUploadImageResponse {
  url: string;
  key: string;
  size: number;
  originalUrl: string;
}

export class DownloadAndUploadImageUseCase {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 segundos
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(
    private readonly imageDownloader: IImageDownloader,
    private readonly imageStorage: IImageStorage
  ) {}

  async execute(
    request: DownloadAndUploadImageRequest
  ): Promise<DownloadAndUploadImageResponse> {
    console.log(`📥 [DownloadAndUpload] Descargando imagen desde: ${request.url}`);

    // 1. Verificar que el downloader soporta esta URL
    if (!this.imageDownloader.supports(request.url)) {
      throw new Error(
        `URL no soportada: ${request.url}. Solo se permiten URLs HTTP/HTTPS o SharePoint.`
      );
    }

    // 2. Descargar imagen desde URL externa
    const downloaded = await this.imageDownloader.download({
      url: request.url,
      sharePointAuth: request.sharePointAuth,
      timeoutMs: request.timeoutMs || this.DEFAULT_TIMEOUT,
      maxSizeBytes: request.maxSizeBytes || this.DEFAULT_MAX_SIZE,
    });

    console.log(
      `✅ [DownloadAndUpload] Imagen descargada: ${downloaded.size} bytes, tipo: ${downloaded.contentType}`
    );

    // 3. Subir a S3 con los IDs correctos para construir el path
    const uploaded = await this.imageStorage.upload({
      buffer: downloaded.buffer,
      filename: downloaded.filename,
      contentType: downloaded.contentType,
      aedId: request.aedId,
      imageId: request.imageId,
      variant: "original",
    });

    console.log(`📤 [DownloadAndUpload] Imagen subida a S3: ${uploaded.url}`);

    return {
      url: uploaded.url,
      key: uploaded.key,
      size: uploaded.size,
      originalUrl: request.url,
    };
  }
}
