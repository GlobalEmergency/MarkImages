/**
 * Column Mapping Service (Application Service)
 *
 * Servicio de aplicación para mapear columnas CSV a campos del sistema.
 * Transforma datos crudos del CSV a AedImportData.
 */

import { AedImportData, AedImportDataProps } from "../../domain/value-objects/AedImportData";
import { CsvRecord } from "./CsvParsingService";

export interface ColumnMapping {
  csvColumn: string;
  systemField: string;
}

export class ColumnMappingService {
  /**
   * Mapea un registro CSV a AedImportData usando los mappings configurados
   */
  mapRecord(record: CsvRecord, mappings: ColumnMapping[]): AedImportData {
    const props: Partial<AedImportDataProps> = {};

    for (const mapping of mappings) {
      const value = record[mapping.csvColumn];
      if (value !== undefined && value !== "") {
        // Usar el systemField como clave en props
        (props as Record<string, string>)[mapping.systemField] = value.trim();
      }
    }

    // Asegurar que proposedName existe (requerido)
    if (!props.proposedName) {
      props.proposedName = "";
    }

    return AedImportData.create(props as AedImportDataProps);
  }

  /**
   * Mapea múltiples registros
   */
  mapRecords(records: CsvRecord[], mappings: ColumnMapping[]): AedImportData[] {
    return records.map((record) => this.mapRecord(record, mappings));
  }

  /**
   * Crea un Map de systemField -> csvColumn para facilitar búsquedas inversas
   */
  createMappingIndex(mappings: ColumnMapping[]): Map<string, string> {
    const index = new Map<string, string>();
    mappings.forEach((m) => {
      index.set(m.systemField, m.csvColumn);
    });
    return index;
  }
}
