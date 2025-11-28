/**
 * Adapter para parseo de archivos CSV
 * Capa de Infraestructura - Implementa ICsvParser
 */

import Papa from "papaparse";
import { CsvRow, CsvRowData } from "@/domain/import/value-objects/CsvRow";
import * as fs from "fs";

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

  parseContent(content: string): CsvParseResult {
    const parseResult = Papa.parse<CsvRowData>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";", // CSV usa punto y coma como separador
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
}
