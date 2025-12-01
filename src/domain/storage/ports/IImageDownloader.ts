/**
 * Puerto (Interface) para descarga de imágenes desde fuentes externas
 * Capa de Dominio - No depende de ninguna implementación
 */

export interface DownloadAuthConfig {
  type: 'cookies' | 'bearer' | 'basic' | 'none';
  cookies?: Record<string, string>;
  token?: string;
  username?: string;
  password?: string;
}

export interface ImageDownloadOptions {
  url: string;
  auth?: DownloadAuthConfig;
  timeout?: number;
  maxRetries?: number;
}

export interface ImageDownloadResult {
  buffer: Buffer;
  contentType: string;
  size: number;
  originalUrl: string;
}

export interface IImageDownloader {
  /**
   * Verifica si este downloader puede manejar la URL dada
   */
  canHandle(url: string): boolean;

  /**
   * Descarga una imagen desde una URL externa
   */
  download(options: ImageDownloadOptions): Promise<ImageDownloadResult>;
}
