/**
 * Adapter HTTP para descarga de imágenes desde URLs externas
 * Capa de Infraestructura - Implementa IImageDownloader
 */

import {
  IImageDownloader,
  ImageDownloadOptions,
  ImageDownloadResult,
} from "@/storage/domain/ports/IImageDownloader";

export class HttpImageDownloader implements IImageDownloader {
  private readonly ALLOWED_CONTENT_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
  ];

  supports(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  }

  async download(options: ImageDownloadOptions): Promise<ImageDownloadResult> {
    const { url, sharePointAuth, timeoutMs = 30000, maxSizeBytes = 10 * 1024 * 1024 } = options;

    // Construir headers
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "image/*,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    // Añadir autenticación de SharePoint si está disponible
    if (sharePointAuth && (sharePointAuth.rtFa || sharePointAuth.fedAuth)) {
      const cookies: string[] = [];
      if (sharePointAuth.rtFa) {
        cookies.push(`rtFa=${sharePointAuth.rtFa}`);
      }
      if (sharePointAuth.fedAuth) {
        cookies.push(`FedAuth=${sharePointAuth.fedAuth}`);
      }
      headers["Cookie"] = cookies.join("; ");
      console.log(`🔐 [HttpImageDownloader] Usando autenticación de SharePoint`);
    }

    try {
      // Realizar la descarga con timeout
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText} al descargar imagen desde ${url}`
        );
      }

      // Verificar tipo de contenido
      const contentType = response.headers.get("content-type") || "";
      if (!this.isValidImageContentType(contentType)) {
        throw new Error(
          `Tipo de contenido no válido: ${contentType}. Solo se permiten imágenes: ${this.ALLOWED_CONTENT_TYPES.join(", ")}`
        );
      }

      // Verificar tamaño del contenido (si está disponible en headers)
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > maxSizeBytes) {
          throw new Error(
            `Imagen demasiado grande: ${(size / 1024 / 1024).toFixed(2)}MB. Máximo permitido: ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB`
          );
        }
      }

      // Descargar el buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verificar tamaño del buffer descargado
      if (buffer.length > maxSizeBytes) {
        throw new Error(
          `Imagen demasiado grande: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Máximo permitido: ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB`
        );
      }

      // Extraer nombre de archivo de la URL
      const filename = this.extractFilename(url, contentType);

      return {
        buffer,
        contentType,
        filename,
        size: buffer.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          throw new Error(`Timeout al descargar imagen desde ${url} después de ${timeoutMs}ms`);
        }
        throw error;
      }
      throw new Error(`Error desconocido al descargar imagen desde ${url}`);
    }
  }

  private isValidImageContentType(contentType: string): boolean {
    const normalized = contentType.toLowerCase().split(";")[0].trim();
    return this.ALLOWED_CONTENT_TYPES.includes(normalized);
  }

  private extractFilename(url: string, contentType: string): string {
    try {
      // Intentar extraer el nombre del archivo de la URL
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const segments = pathname.split("/");
      const lastSegment = segments[segments.length - 1];

      // Si el último segmento tiene extensión, usarlo
      if (lastSegment && lastSegment.includes(".")) {
        return lastSegment;
      }

      // Si no, generar nombre basado en el contentType
      const extension = this.getExtensionFromContentType(contentType);
      const timestamp = Date.now();
      return `image-${timestamp}.${extension}`;
    } catch {
      // Fallback: nombre genérico
      const extension = this.getExtensionFromContentType(contentType);
      return `image-${Date.now()}.${extension}`;
    }
  }

  private getExtensionFromContentType(contentType: string): string {
    const typeMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
    };

    const normalized = contentType.toLowerCase().split(";")[0].trim();
    return typeMap[normalized] || "jpg";
  }
}
