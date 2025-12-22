/**
 * CSV Parsing Service (Application Service)
 *
 * Servicio de aplicación para leer y parsear archivos CSV.
 * Infraestructura pura, sin lógica de negocio.
 */

import * as fs from "fs";

export interface CsvRecord {
  [key: string]: string;
}

export interface CsvParseResult {
  headers: string[];
  records: CsvRecord[];
  totalRows: number;
}

export class CsvParsingService {
  /**
   * Lee y parsea un archivo CSV completo
   */
  parseFile(filePath: string, delimiter: string = ";"): CsvParseResult {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return this.parseContent(content, delimiter);
    } catch (error) {
      throw new Error(
        `Error reading CSV file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parsea el contenido de un CSV desde string
   */
  parseContent(content: string, delimiter: string = ";"): CsvParseResult {
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      return { headers: [], records: [], totalRows: 0 };
    }

    // Parse headers
    const headers = this.parseLine(lines[0], delimiter);

    // Parse records
    const records: CsvRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseLine(lines[i], delimiter);
      const record: CsvRecord = {};

      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });

      records.push(record);
    }

    return {
      headers,
      records,
      totalRows: records.length,
    };
  }

  /**
   * Parsea una línea CSV respetando comillas
   */
  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Comilla escapada
          current += '"';
          i++;
        } else {
          // Inicio o fin de comillas
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Delimitador fuera de comillas
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Lee solo los primeros N registros (para preview)
   */
  parsePreview(filePath: string, maxRows: number, delimiter: string = ";"): CsvParseResult {
    const fullResult = this.parseFile(filePath, delimiter);

    return {
      headers: fullResult.headers,
      records: fullResult.records.slice(0, maxRows),
      totalRows: fullResult.totalRows,
    };
  }
}
