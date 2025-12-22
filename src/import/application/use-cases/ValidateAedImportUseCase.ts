/**
 * Validate AED Import Use Case
 *
 * Caso de uso para validar una importación de AEDs SIN crear BatchJob.
 * Diseñado para validación previa rápida (< 60s para Vercel).
 * NO persiste nada en base de datos, solo valida.
 */

import { ValidationResult } from "../../domain/value-objects/ValidationResult";
import { AedImportOrchestrator } from "../services/AedImportOrchestrator";
import { ColumnMapping } from "../services/ColumnMappingService";

export interface ValidateAedImportRequest {
  filePath: string;
  mappings: ColumnMapping[];
  delimiter?: string;
  maxRows?: number;
  skipDuplicates?: boolean;
}

export class ValidateAedImportUseCase {
  private readonly MAX_ROWS = 100;
  private readonly TIMEOUT_MS = 45000; // 45 segundos (buffer de 15s para Vercel)

  constructor(private readonly orchestrator: AedImportOrchestrator) {}

  async execute(request: ValidateAedImportRequest): Promise<ValidationResult> {
    const startTime = Date.now();

    // Limitar registros para Vercel
    const maxRows = Math.min(request.maxRows || 100, this.MAX_ROWS);

    // Función para verificar timeout
    const checkTimeout = () => {
      return Date.now() - startTime > this.TIMEOUT_MS;
    };

    // Ejecutar validación
    const result = await this.orchestrator.validateRecords({
      filePath: request.filePath,
      mappings: request.mappings,
      delimiter: request.delimiter || ";",
      maxRows,
      skipDuplicates: request.skipDuplicates ?? true,
      checkTimeout,
    });

    const duration = Date.now() - startTime;
    console.log(`Validation completed in ${duration}ms`);

    return result;
  }
}
