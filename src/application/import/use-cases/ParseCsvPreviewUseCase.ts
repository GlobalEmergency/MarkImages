/**
 * Use Case: Parsear preview de CSV
 * Lee un archivo CSV y genera un preview con headers y datos de muestra
 * Capa de Aplicación
 */

import { CsvPreview } from '@/domain/import/value-objects/CsvPreview';

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
    const { filePath, sampleSize = 5, delimiter = ';' } = request;

    try {
      // Leer archivo CSV
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      // Parsear contenido
      const lines = content.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        return {
          preview: null as any,
          success: false,
          error: 'El archivo CSV está vacío',
        };
      }

      // Obtener headers (primera línea)
      const headerLine = lines[0]!;
      const headers = this.parseRow(headerLine, delimiter);

      if (headers.length === 0) {
        return {
          preview: null as any,
          success: false,
          error: 'No se pudieron detectar las columnas del CSV',
        };
      }

      // Obtener filas de muestra
      const dataLines = lines.slice(1);
      const totalRows = dataLines.length;
      const sampleLines = dataLines.slice(0, sampleSize);
      const sampleRows = sampleLines.map((line) => this.parseRow(line, delimiter));

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
      console.error('Error parsing CSV preview:', error);
      return {
        preview: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al leer el CSV',
      };
    }
  }

  /**
   * Parsea una línea del CSV respetando comillas y delimitadores
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

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
      } else if (char === delimiter && !inQuotes) {
        // Encontramos un delimitador fuera de comillas
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Agregar el último campo
    result.push(current.trim());

    return result;
  }

  /**
   * Detecta automáticamente el delimitador del CSV
   */
  private detectDelimiter(content: string): string {
    const possibleDelimiters = [';', ',', '\t', '|'];
    const firstLine = content.split('\n')[0] || '';

    let bestDelimiter = ';';
    let maxCount = 0;

    for (const delimiter of possibleDelimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }
}
