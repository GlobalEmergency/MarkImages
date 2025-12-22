/**
 * Adapter para descarga de imágenes desde SharePoint
 * Capa de Infraestructura - Implementa IImageDownloader
 */

import axios, { AxiosRequestConfig } from "axios";

import {
  IImageDownloader,
  ImageDownloadOptions,
  ImageDownloadResult,
  SharePointAuthConfig,
} from "@/storage/domain/ports/IImageDownloader";

export class SharePointImageDownloader implements IImageDownloader {
  private readonly SHAREPOINT_DOMAINS = [
    "sharepoint.com",
    "sharepoint-df.com",
    "microsoft.sharepoint.com",
  ];

  private readonly MIN_IMAGE_SIZE = 1024; // 1KB - tamaño mínimo esperado para una imagen
  private readonly LOGIN_INDICATORS = [
    "login",
    "signin",
    "authentication",
    "oauth",
    "sso",
    "accessdenied",
  ];

  supports(url: string): boolean {
    return this.canHandle(url);
  }

  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.SHAREPOINT_DOMAINS.some((domain) =>
        urlObj.hostname.toLowerCase().includes(domain)
      );
    } catch {
      return false;
    }
  }

  async download(options: ImageDownloadOptions): Promise<ImageDownloadResult> {
    const { url, sharePointAuth, timeoutMs = 30000 } = options;
    const maxRetries = 2;

    if (!this.canHandle(url)) {
      throw new Error(`URL no es de SharePoint: ${url}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config = this.buildRequestConfig(sharePointAuth, timeoutMs);
        const response = await axios.get(url, {
          ...config,
          responseType: "arraybuffer",
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400, // Aceptar redirects
        });

        // 🔍 VALIDACIÓN 1: Detectar redirecciones a páginas de login
        const finalUrl = response.request?.res?.responseUrl || response.config.url || url;
        if (this.isLoginPage(finalUrl)) {
          throw new Error(
            `Autenticación inválida: SharePoint redirigió a página de login. ` +
              `Verifica que las cookies (FedAuth, rtFa) sean válidas y no hayan expirado.`
          );
        }

        const buffer = Buffer.from(response.data);
        const contentType = response.headers["content-type"] || "";

        // 🔍 VALIDACIÓN 2: Verificar que el Content-Type sea de imagen
        if (!this.isImageContentType(contentType)) {
          throw new Error(
            `Respuesta inválida de SharePoint: Content-Type="${contentType}" (esperado: image/*). ` +
              `Posible causa: cookies inválidas o archivo no es una imagen.`
          );
        }

        // 🔍 VALIDACIÓN 3: Verificar tamaño mínimo (evitar respuestas HTML pequeñas)
        if (buffer.length < this.MIN_IMAGE_SIZE) {
          throw new Error(
            `Imagen demasiado pequeña (${buffer.length} bytes). ` +
              `Posible causa: respuesta HTML en lugar de imagen.`
          );
        }

        // 🔍 VALIDACIÓN 4: Verificar magic bytes de imagen (primeros bytes del archivo)
        if (!this.hasValidImageSignature(buffer)) {
          const preview = buffer.slice(0, 100).toString("utf-8", 0, 50).trim();
          throw new Error(
            `Archivo no es una imagen válida. Posible respuesta HTML. ` +
              `Primeros bytes: "${preview}..."`
          );
        }

        // Extraer filename de la URL
        const filename = this.extractFilename(url);
        
        return {
          buffer,
          contentType,
          filename,
          size: buffer.length,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Si es error de autenticación, no reintentar
        if (
          lastError.message.includes("Autenticación inválida") ||
          lastError.message.includes("cookies inválidas")
        ) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          // Esperar antes de reintentar (exponential backoff)
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw new Error(
      `Failed to download image from SharePoint after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  private buildRequestConfig(
    auth?: SharePointAuthConfig,
    timeout?: number
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    if (!auth) {
      return config;
    }

    // Construir cookie string con FedAuth y rtFa
    const cookies: string[] = [];
    if (auth.fedAuth) {
      cookies.push(`FedAuth=${auth.fedAuth}`);
    }
    if (auth.rtFa) {
      cookies.push(`rtFa=${auth.rtFa}`);
    }

    if (cookies.length > 0) {
      config.headers = {
        ...config.headers,
        Cookie: cookies.join("; "),
      };
    }

    return config;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extrae el nombre del archivo de una URL
   */
  private extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1] || 'image.jpg';
      return filename;
    } catch {
      return 'image.jpg';
    }
  }

  /**
   * Detecta si una URL parece ser una página de login
   */
  private isLoginPage(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return this.LOGIN_INDICATORS.some((indicator) => lowerUrl.includes(indicator));
  }

  /**
   * Verifica si el Content-Type es de imagen
   */
  private isImageContentType(contentType: string): boolean {
    const lowerContentType = contentType.toLowerCase();
    return (
      lowerContentType.startsWith("image/") ||
      lowerContentType.includes("jpeg") ||
      lowerContentType.includes("jpg") ||
      lowerContentType.includes("png") ||
      lowerContentType.includes("gif") ||
      lowerContentType.includes("webp") ||
      lowerContentType.includes("bmp")
    );
  }

  /**
   * Verifica la firma mágica (magic bytes) del archivo
   * Los primeros bytes identifican el tipo de archivo
   */
  private hasValidImageSignature(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return true;
    }

    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return true;
    }

    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return true;
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }

    // Si empieza con < o <!DOCTYPE significa que es HTML
    const firstBytes = buffer.slice(0, 15).toString("utf-8").trim();
    if (firstBytes.startsWith("<") || firstBytes.startsWith("<!DOCTYPE")) {
      return false;
    }

    return false;
  }

  /**
   * Valida que las credenciales de SharePoint son válidas
   * Intenta descargar una imagen de prueba para verificar autenticación
   */
  async validateAuthentication(
    testImageUrl: string,
    auth?: SharePointAuthConfig
  ): Promise<{
    valid: boolean;
    message: string;
    details: {
      statusCode?: number;
      redirectedToLogin?: boolean;
      contentType?: string;
      responseSize?: number;
      error?: string;
    };
  }> {
    try {
      // Verificar que la URL sea de SharePoint
      if (!this.canHandle(testImageUrl)) {
        return {
          valid: false,
          message: "La URL proporcionada no es de SharePoint",
          details: {
            error: "URL inválida",
          },
        };
      }

      const config = this.buildRequestConfig(auth, 10000); // 10 segundos timeout

      // Primero intentar HEAD request (más ligero)
      try {
        const headResponse = await axios.head(testImageUrl, {
          ...config,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        const finalUrl =
          headResponse.request?.res?.responseUrl || headResponse.config.url || testImageUrl;
        const contentType = headResponse.headers["content-type"] || "";

        // Verificar redirección a login
        if (this.isLoginPage(finalUrl)) {
          return {
            valid: false,
            message:
              "Las cookies de SharePoint son inválidas o han expirado. Redirige a página de login.",
            details: {
              statusCode: headResponse.status,
              redirectedToLogin: true,
              contentType,
            },
          };
        }

        // Verificar Content-Type
        if (!this.isImageContentType(contentType)) {
          return {
            valid: false,
            message: `Respuesta inválida: Content-Type="${contentType}" (esperado: image/*)`,
            details: {
              statusCode: headResponse.status,
              redirectedToLogin: false,
              contentType,
            },
          };
        }

        // HEAD exitoso y Content-Type correcto
        return {
          valid: true,
          message: "✅ Cookies de SharePoint válidas. Las imágenes se importarán correctamente.",
          details: {
            statusCode: headResponse.status,
            redirectedToLogin: false,
            contentType,
          },
        };
      } catch (headError) {
        console.warn("HEAD request falló, intentando GET completo:", headError);
        // Si HEAD falla, intentar GET completo
        const getResponse = await axios.get(testImageUrl, {
          ...config,
          responseType: "arraybuffer",
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        const finalUrl =
          getResponse.request?.res?.responseUrl || getResponse.config.url || testImageUrl;
        const buffer = Buffer.from(getResponse.data);
        const contentType = getResponse.headers["content-type"] || "";

        // Verificar redirección a login
        if (this.isLoginPage(finalUrl)) {
          return {
            valid: false,
            message:
              "Las cookies de SharePoint son inválidas o han expirado. Redirige a página de login.",
            details: {
              statusCode: getResponse.status,
              redirectedToLogin: true,
              contentType,
              responseSize: buffer.length,
            },
          };
        }

        // Verificar Content-Type
        if (!this.isImageContentType(contentType)) {
          return {
            valid: false,
            message: `Respuesta inválida: Content-Type="${contentType}" (esperado: image/*)`,
            details: {
              statusCode: getResponse.status,
              redirectedToLogin: false,
              contentType,
              responseSize: buffer.length,
            },
          };
        }

        // Verificar tamaño mínimo
        if (buffer.length < this.MIN_IMAGE_SIZE) {
          return {
            valid: false,
            message: `Respuesta muy pequeña (${buffer.length} bytes). Posible HTML en lugar de imagen.`,
            details: {
              statusCode: getResponse.status,
              redirectedToLogin: false,
              contentType,
              responseSize: buffer.length,
            },
          };
        }

        // Verificar magic bytes
        if (!this.hasValidImageSignature(buffer)) {
          return {
            valid: false,
            message: "El archivo descargado no es una imagen válida. Posible respuesta HTML.",
            details: {
              statusCode: getResponse.status,
              redirectedToLogin: false,
              contentType,
              responseSize: buffer.length,
            },
          };
        }

        // GET exitoso y archivo válido
        return {
          valid: true,
          message: "✅ Cookies de SharePoint válidas. Las imágenes se importarán correctamente.",
          details: {
            statusCode: getResponse.status,
            redirectedToLogin: false,
            contentType,
            responseSize: buffer.length,
          },
        };
      }
    } catch (error) {
      const axiosError = error as any;
      const statusCode = axiosError?.response?.status;

      // Casos especiales de error
      if (statusCode === 401 || statusCode === 403) {
        return {
          valid: false,
          message: "Acceso denegado. Las cookies de SharePoint son inválidas o han expirado.",
          details: {
            statusCode,
            error: "Unauthorized/Forbidden",
          },
        };
      }

      return {
        valid: false,
        message: `Error al validar cookies: ${axiosError?.message || String(error)}`,
        details: {
          statusCode,
          error: axiosError?.message || String(error),
        },
      };
    }
  }
}
