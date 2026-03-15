/**
 * Adapter para parseo de archivos CSV
 * Capa de Infraestructura - Implementa ICsvParser
 */

import * as fs from "fs";

import Papa from "papaparse";

import { CsvRow, CsvRowData } from "@/import/domain/value-objects/CsvRow";

export interface CsvParseResult {
  rows: CsvRow[];
  totalRows: number;
  errors: ParseError[];
}

export interface ParseError {
  row: number;
  message: string;
  data?: unknown;
}

export class CsvParserAdapter {
  async parseFile(filePath: string): Promise<CsvParseResult> {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return this.parseContent(fileContent);
    } catch (error) {
      throw new Error(
        `Error leyendo archivo CSV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parsea contenido CSV al formato legacy CsvRow (formulario Madrid).
   * Delimitador hardcodeado a ";" por compatibilidad con el flujo de importación manual.
   */
  parseContent(content: string): CsvParseResult {
    const parseResult = Papa.parse<CsvRowData>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";", // CSV importación manual usa punto y coma
      transformHeader: (header: string) => header.trim(),
    });

    const rows: CsvRow[] = [];
    const errors: ParseError[] = [];

    parseResult.data.forEach((rowData, index) => {
      try {
        const csvRow = new CsvRow(rowData);
        rows.push(csvRow);
      } catch (error) {
        errors.push({
          row: index + 2, // +2 porque índice empieza en 0 y primera fila es header
          message: error instanceof Error ? error.message : String(error),
          data: rowData,
        });
      }
    });

    // Añadir errores de parsing de Papa
    if (parseResult.errors.length > 0) {
      parseResult.errors.forEach((error) => {
        errors.push({
          row: error.row || 0,
          message: error.message,
        });
      });
    }

    return {
      rows,
      totalRows: parseResult.data.length,
      errors,
    };
  }

  /**
   * Parsea contenido CSV a registros genéricos Record<string, string>.
   * Usado por fuentes de datos externas (sync remoto) donde los campos
   * varían según la fuente y se normalizan vía fieldMappings.
   *
   * @param content - Texto CSV
   * @param delimiter - Separador (auto-detectado por PapaParse si no se especifica)
   */
  parseToRecords(
    content: string,
    delimiter?: string
  ): { records: Record<string, string>[]; errors: ParseError[] } {
    const parseResult = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter || undefined, // undefined = PapaParse auto-detect
      transformHeader: (header: string) => header.trim(),
    });

    const errors: ParseError[] = parseResult.errors.map((error) => ({
      row: error.row || 0,
      message: error.message,
    }));

    return {
      records: parseResult.data,
      errors,
    };
  }
}
