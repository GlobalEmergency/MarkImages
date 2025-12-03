/**
 * Puerto: Servicio de detección de duplicados
 * Capa de Dominio - Interface
 */

import { DuplicateCheckResult } from "../value-objects/DuplicateCheckResult";

export interface DuplicateDetectionCriteria {
  name: string;
  streetType?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;

  // Opciones de búsqueda
  exactMatch?: boolean; // true = coincidencia exacta, false = fuzzy matching
  similarityThreshold?: number; // 0-1, default 0.9 (solo para fuzzy)
}

export interface IDuplicateDetectionService {
  /**
   * Verifica si existe un DEA duplicado en el sistema
   * @param criteria Criterios de búsqueda (nombre y dirección)
   * @returns Resultado indicando si es duplicado y matches encontrados
   */
  checkDuplicate(criteria: DuplicateDetectionCriteria): Promise<DuplicateCheckResult>;

  /**
   * Verifica múltiples registros de una vez (optimización para imports masivos)
   * @param criteriaList Lista de criterios a verificar
   * @returns Map con índice → resultado
   */
  checkMultipleDuplicates(
    criteriaList: DuplicateDetectionCriteria[]
  ): Promise<Map<number, DuplicateCheckResult>>;
}
