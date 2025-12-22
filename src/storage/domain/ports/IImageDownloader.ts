/**
 * Puerto (Interface) para descarga de imágenes desde URLs externas
 * Capa de Dominio - No depende de ninguna implementación
 */

export interface SharePointAuthConfig {
  rtFa?: string;
  fedAuth?: string;
}

export interface ImageDownloadOptions {
  url: string;
  sharePointAuth?: SharePointAuthConfig;
  timeoutMs?: number;
  maxSizeBytes?: number;
}

export interface ImageDownloadResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
  size: number;
}

export interface IImageDownloader {
  /**
   * Descarga una imagen desde una URL externa
   * @throws Error si la URL no es válida, la descarga falla, o el contenido no es una imagen
   */
  download(options: ImageDownloadOptions): Promise<ImageDownloadResult>;

  /**
   * Verifica si una URL es soportada por este downloader
   */
  supports(url: string): boolean;
}
