/**
 * Value Object: Preview del contenido de un CSV
 * Contiene headers y datos de muestra para mostrar al usuario
 * Capa de Dominio
 */

export class CsvPreview {
  private constructor(
    private readonly headers: string[],
    private readonly sampleRows: string[][],
    private readonly totalRows: number,
    private readonly delimiter: string
  ) {
    if (headers.length === 0) {
      throw new Error('CSV must have at least one column');
    }
  }

  get columnHeaders(): string[] {
    return [...this.headers];
  }

  get sampleData(): string[][] {
    return this.sampleRows.map((row) => [...row]);
  }

  get totalRecords(): number {
    return this.totalRows;
  }

  get csvDelimiter(): string {
    return this.delimiter;
  }

  get columnCount(): number {
    return this.headers.length;
  }

  get sampleSize(): number {
    return this.sampleRows.length;
  }

  /**
   * Obtiene el índice de una columna por su nombre
   */
  getColumnIndex(columnName: string): number {
    return this.headers.indexOf(columnName);
  }

  /**
   * Verifica si una columna existe
   */
  hasColumn(columnName: string): boolean {
    return this.headers.includes(columnName);
  }

  /**
   * Obtiene los valores de una columna específica en las filas de muestra
   */
  getColumnSampleValues(columnName: string): string[] {
    const index = this.getColumnIndex(columnName);
    if (index === -1) {
      return [];
    }

    return this.sampleRows.map((row) => row[index] || '');
  }

  /**
   * Valida que todas las filas tengan el mismo número de columnas
   */
  isValid(): boolean {
    return this.sampleRows.every((row) => row.length === this.headers.length);
  }

  /**
   * Obtiene estadísticas básicas del CSV
   */
  getStats(): {
    totalRows: number;
    columnCount: number;
    sampleSize: number;
    hasEmptyColumns: boolean;
    emptyColumns: string[];
  } {
    const emptyColumns: string[] = [];

    for (let i = 0; i < this.headers.length; i++) {
      const columnValues = this.sampleRows.map((row) => row[i] || '').filter((v) => v.trim());

      if (columnValues.length === 0) {
        emptyColumns.push(this.headers[i]!);
      }
    }

    return {
      totalRows: this.totalRows,
      columnCount: this.headers.length,
      sampleSize: this.sampleRows.length,
      hasEmptyColumns: emptyColumns.length > 0,
      emptyColumns,
    };
  }

  /**
   * Crea un CsvPreview desde datos parseados
   */
  static create(
    headers: string[],
    sampleRows: string[][],
    totalRows: number,
    delimiter: string = ';'
  ): CsvPreview {
    return new CsvPreview(headers, sampleRows, totalRows, delimiter);
  }

  /**
   * Convierte a objeto plano para serialización
   */
  toJSON(): {
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
    delimiter: string;
  } {
    return {
      headers: this.headers,
      sampleRows: this.sampleRows,
      totalRows: this.totalRows,
      delimiter: this.delimiter,
    };
  }

  /**
   * Crea desde objeto plano
   */
  static fromJSON(data: {
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
    delimiter: string;
  }): CsvPreview {
    return new CsvPreview(data.headers, data.sampleRows, data.totalRows, data.delimiter);
  }
}
