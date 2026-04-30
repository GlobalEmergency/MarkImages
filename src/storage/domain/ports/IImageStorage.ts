/**
 * Puerto (Interface) para almacenamiento de imágenes
 * Capa de Dominio - No depende de ninguna implementación
 */

/** Image variant types (domain concept, not tied to any storage impl) */
export type ImageVariant = "original" | "processed" | "thumb";

export interface ImageUploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  prefix?: string;
  metadata?: Record<string, string>;
  // New structure parameters
  aedId?: string;
  imageId?: string;
  variant?: ImageVariant;
}

export interface ImageUploadResult {
  url: string;
  key: string;
  size: number;
}

export interface IImageStorage {
  /**
   * Sube una imagen al sistema de almacenamiento
   */
  upload(options: ImageUploadOptions): Promise<ImageUploadResult>;

  /**
   * Elimina una imagen del sistema de almacenamiento
   */
  delete(key: string): Promise<void>;

  /**
   * Genera una URL de acceso a la imagen
   */
  getPublicUrl(key: string): string;
}
