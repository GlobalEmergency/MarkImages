/**
 * Domain Service: Mapea datos raw del CSV a DynamicCsvRow
 * Esta es la lógica ÚNICA compartida entre validación e importación
 * Capa de Dominio
 */

import { DynamicCsvRow } from '../value-objects/DynamicCsvRow';

export interface CsvColumnMapping {
  csvColumn: string;
  systemField: string;
}

/**
 * Servicio de dominio para mapear filas CSV
 * Garantiza que validación e importación usen la misma lógica
 */
export class CsvRowMapper {
  /**
   * Construye DynamicCsvRow aplicando los mappings del usuario
   * 
   * @param rawData - Datos raw del CSV como objeto clave-valor (nombre columna → valor)
   * @param mappings - Mapeos configurados por el usuario (columna CSV → campo del sistema)
   * @returns DynamicCsvRow con los datos mapeados correctamente
   * 
   * Ejemplo:
   * rawData = { "NOMBRE": "Hospital", "CALLE": "Gran Vía", "NUM": "1" }
   * mappings = [
   *   { csvColumn: "NOMBRE", systemField: "proposedName" },
   *   { csvColumn: "CALLE", systemField: "streetName" },
   *   { csvColumn: "NUM", systemField: "streetNumber" }
   * ]
   * 
   * Resultado: DynamicCsvRow con { proposedName: "Hospital", streetName: "Gran Vía", streetNumber: "1" }
   */
  static buildDynamicRow(
    rawData: Record<string, string>,
    mappings: CsvColumnMapping[]
  ): DynamicCsvRow {
    const mappedData: Record<string, string> = {};

    // Aplicar cada mapeo
    for (const mapping of mappings) {
      const value = rawData[mapping.csvColumn];
      
      // Solo agregar valores que existen y no están vacíos
      if (value !== undefined && value !== null && value.trim() !== '') {
        mappedData[mapping.systemField] = value.trim();
      }
    }

    return new DynamicCsvRow(mappedData);
  }

  /**
   * Construye un objeto raw desde un array de valores CSV
   * 
   * @param rowValues - Array de valores de la fila CSV
   * @param columnNames - Nombres de las columnas (headers del CSV)
   * @returns Objeto clave-valor con los datos raw
   */
  static buildRawDataFromArray(
    rowValues: string[],
    columnNames: string[]
  ): Record<string, string> {
    const rawData: Record<string, string> = {};

    for (let i = 0; i < columnNames.length; i++) {
      const columnName = columnNames[i];
      const value = rowValues[i] || '';
      
      if (columnName) {
        rawData[columnName] = value;
      }
    }

    return rawData;
  }
}
