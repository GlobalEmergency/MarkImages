/**
 * S3 Data Source â€” @batchactions/import DataSource adapter
 *
 * Implementa la interface DataSource de @batchactions/import para leer CSVs
 * almacenados en S3. Descarga el archivo completo y lo sirve como string.
 *
 * Para archivos locales, usa FilePathSource de @batchactions/import directamente.
 * Para buffers en memoria, usa BufferSource de @batchactions/import directamente.
 */

import type { DataSource } from "@batchactions/import";
import type { SourceMetadata } from "@batchactions/core";
import { MAX_CSV_FILE_SIZE_BYTES } from "../../constants";

/**
 * DataSource que lee desde una URL de S3 (o cualquier HTTP/HTTPS URL).
 *
 * @example
 * ```typescript
 * const source = new S3DataSource('https://bucket.s3.eu-west-1.amazonaws.com/imports/data.csv');
 * const importer = new BulkImport({ schema: aedImportSchema });
 * importer.from(source, new CsvParser());
 * ```
 */
/** Límite máximo de tamaño importado desde constants */

export class S3DataSource implements DataSource {
  private readonly url: string;
  private readonly fileName: string;
  private readonly maxFileSize: number;
  private cachedContent: string | null = null;

  constructor(url: string, fileName?: string, maxFileSize?: number) {
    this.url = url;
    this.fileName = fileName || this.extractFileName(url);
    this.maxFileSize = maxFileSize ?? MAX_CSV_FILE_SIZE_BYTES;
  }

  /**
   * Yield el contenido completo del archivo como un string.
   * Cachea el contenido para permitir mÃºltiples lecturas (processChunk + restore).
   */
  async *read(): AsyncIterable<string | Buffer> {
    if (!this.cachedContent) {
      this.cachedContent = await this.download();
    }
    yield this.cachedContent;
  }

  /**
   * Devuelve una muestra del contenido para preview/detecciÃ³n.
   * Descarga el archivo completo (S3 no soporta range requests fÃ¡cilmente en URLs pÃºblicas).
   */
  async sample(maxBytes?: number): Promise<string | Buffer> {
    if (!this.cachedContent) {
      this.cachedContent = await this.download();
    }

    if (maxBytes && this.cachedContent.length > maxBytes) {
      return this.cachedContent.substring(0, maxBytes);
    }

    return this.cachedContent;
  }

  /**
   * Metadata sobre la fuente de datos.
   */
  metadata(): SourceMetadata {
    return {
      fileName: this.fileName,
      mimeType: "text/csv",
      ...(this.cachedContent && { fileSize: Buffer.byteLength(this.cachedContent, "utf-8") }),
    };
  }

  /**
   * Descarga el archivo desde la URL.
   * Valida el tamaño antes de descargar el contenido completo.
   */
  private async download(): Promise<string> {
    const response = await fetch(this.url);

    if (!response.ok) {
      throw new Error(
        `Failed to download CSV from S3: ${response.statusText} (${response.status})`
      );
    }

    // Validar tamaño si el servidor lo reporta
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > this.maxFileSize) {
        throw new Error(
          `CSV file too large: ${(size / 1024 / 1024).toFixed(1)} MB ` +
            `(max ${(this.maxFileSize / 1024 / 1024).toFixed(0)} MB)`
        );
      }
    }

    const buffer = await response.arrayBuffer();

    // Validar tamaño real del contenido descargado
    if (buffer.byteLength > this.maxFileSize) {
      throw new Error(
        `CSV file too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB ` +
          `(max ${(this.maxFileSize / 1024 / 1024).toFixed(0)} MB)`
      );
    }

    const content = Buffer.from(buffer).toString("utf-8");

    // Eliminar BOM si existe
    if (content.charCodeAt(0) === 0xfeff) {
      return content.substring(1);
    }

    return content;
  }

  /**
   * Extrae el nombre del archivo de una URL de S3.
   */
  private extractFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      return pathParts[pathParts.length - 1] || "import.csv";
    } catch {
      return "import.csv";
    }
  }

  /**
   * Limpia el cache del contenido descargado.
   * Ãštil para liberar memoria despuÃ©s de procesar.
   */
  clearCache(): void {
    this.cachedContent = null;
  }
}
