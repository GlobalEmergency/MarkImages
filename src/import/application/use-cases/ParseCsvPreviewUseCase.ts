/**
 * Use Case: Parsear preview de CSV
 * Lee un archivo CSV y genera un preview con headers y datos de muestra
 * Capa de Aplicación
 */

import { CsvPreview } from "@/import/domain/value-objects/CsvPreview";

export interface ParseCsvPreviewRequest {
  filePath: string;
  sampleSize?: number;
  delimiter?: string;
}

export interface ParseCsvPreviewResponse {
  preview: CsvPreview;
  success: boolean;
  error?: string;
}

export class ParseCsvPreviewUseCase {
  /**
   * Ejecuta el parsing del CSV y genera el preview
   */
  async execute(request: ParseCsvPreviewRequest): Promise<ParseCsvPreviewResponse> {
    const { filePath, sampleSize = 5, delimiter = ";" } = request;

    try {
      // Leer archivo CSV
      const fs = await import("fs/promises");
      const content = await fs.readFile(filePath, "utf-8");

      // Parsear contenido
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        return {
          preview: null as unknown as CsvPreview,
          success: false,
          error: "El archivo CSV está vacío",
        };
      }

      // Obtener headers (primera línea)
      const headerLine = lines[0]!;
      const rawHeaders = this.parseRow(headerLine, delimiter);

      // 🔧 FIX: Filtrar headers vacíos y limpiar espacios
      const headers = rawHeaders.map((h) => h.trim()).filter((h) => h.length > 0);

      if (headers.length === 0) {
        return {
          preview: null as unknown as CsvPreview,
          success: false,
          error: "No se pudieron detectar las columnas del CSV",
        };
      }

      // Obtener filas de muestra
      const dataLines = lines.slice(1);
      const totalRows = dataLines.length;
      const sampleLines = dataLines.slice(0, sampleSize);

      // 🔧 FIX: Normalizar filas al mismo número de columnas que headers válidos
      const sampleRows = sampleLines.map((line) => {
        const rawRow = this.parseRow(line, delimiter);
        // Tomar solo las mismas columnas que headers válidos
        return rawRow.slice(0, headers.length).map((cell) => cell.trim());
      });

      // Validar que todas las filas tengan el mismo número de columnas
      const invalidRows = sampleRows.filter((row) => row.length !== headers.length);
      if (invalidRows.length > 0) {
        console.warn(
          `⚠️ Se encontraron ${invalidRows.length} filas con número incorrecto de columnas en la muestra`
        );
      }

      // Crear preview
      const preview = CsvPreview.create(headers, sampleRows, totalRows, delimiter);

      return {
        preview,
        success: true,
      };
    } catch (error) {
      console.error("Error parsing CSV preview:", error);
      return {
        preview: null as unknown as CsvPreview,
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido al leer el CSV",
      };
    }
  }

  /**
   * Parsea una línea del CSV respetando comillas y delimitadores
   * 🔧 MEJORADO: Maneja correctamente delimitadores finales y columnas vacías
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let fieldStarted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      const nextChar = line[i + 1];

      if (char === '"') {
        // Manejar comillas dobles escapadas
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Saltar la siguiente comilla
        } else {
          inQuotes = !inQuotes;
        }
        fieldStarted = true;
      } else if (char === delimiter && !inQuotes) {
        // Encontramos un delimitador fuera de comillas
        result.push(current.trim());
        current = "";
        fieldStarted = false;
      } else {
        current += char;
        if (char.trim()) fieldStarted = true;
      }
    }

    // 🔧 FIX: Solo agregar el último campo si tiene contenido o si se inició un campo
    const trimmedLast = current.trim();
    if (trimmedLast.length > 0 || fieldStarted) {
      result.push(trimmedLast);
    }

    return result;
  }

  /**
   * Detecta automáticamente el delimitador del CSV
   */
  private detectDelimiter(content: string): string {
    const possibleDelimiters = [";", ",", "\t", "|"];
    const firstLine = content.split("\n")[0] || "";

    let bestDelimiter = ";";
    let maxCount = 0;

    for (const delimiter of possibleDelimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, "g")) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }
}
