/**
 * AED Duplicate Checker â€” @batchactions/import DuplicateChecker adapter
 *
 * Implementa la interface DuplicateChecker de @batchactions/import para verificar
 * duplicados contra la base de datos PostgreSQL usando el patrÃ³n cascade:
 * ID â†’ Code â†’ ExternalReference
 *
 * Reutiliza la lÃ³gica existente de DuplicateDetectionService y IAedRepository.
 */

import type {
  DuplicateChecker,
  DuplicateCheckResult as BulkImportDuplicateResult,
  ProcessingContext,
} from "@batchactions/import";
import type { IAedRepository } from "../../domain/ports/IAedRepository";

export interface AedDuplicateCheckerOptions {
  /**
   * Si true, los duplicados se reportan como warning (no bloquean).
   * Si false, los duplicados se reportan como error (bloquean el record).
   * Default: true
   */
  skipDuplicates?: boolean;
}

/**
 * Adapter que conecta IAedRepository con la interface DuplicateChecker de @batchactions/import.
 *
 * Cascade matching:
 * 1. Por ID (si presente y formato UUID vÃ¡lido)
 * 2. Por code (cÃ³digo DEA)
 * 3. Por externalReference (referencia en sistema externo)
 *
 * @example
 * ```typescript
 * const checker = new AedDuplicateChecker(aedRepository, { skipDuplicates: true });
 * const importer = new BulkImport({
 *   schema: aedImportSchema,
 *   duplicateChecker: checker,
 * });
 * ```
 */
export class AedDuplicateChecker implements DuplicateChecker {
  private readonly aedRepository: IAedRepository;
  private readonly skipDuplicates: boolean;

  constructor(aedRepository: IAedRepository, options?: AedDuplicateCheckerOptions) {
    this.aedRepository = aedRepository;
    this.skipDuplicates = options?.skipDuplicates ?? true;
  }

  /**
   * Verifica si un registro es duplicado contra la base de datos.
   * Usa cascade matching: ID â†’ Code â†’ ExternalReference
   */
  async check(fields: Record<string, unknown>): Promise<BulkImportDuplicateResult> {
    const id = this.extractString(fields, "id");
    const code = this.extractString(fields, "code");
    const externalRef = this.extractString(fields, "externalReference");

    // Si no hay ningÃºn identificador, no podemos verificar duplicados
    if (!id && !code && !externalRef) {
      return { isDuplicate: false };
    }

    // ========================================
    // PRIORIDAD 1: Buscar por ID
    // ========================================
    if (id) {
      try {
        const result = await this.aedRepository.findById(id);
        if (result && result.isDuplicate) {
          return {
            isDuplicate: true,
            existingId: result.matchedAedId,
            metadata: {
              matchedBy: "id",
              matchedCode: result.matchedCode,
              matchedExternalReference: result.matchedExternalReference,
              skipDuplicates: this.skipDuplicates,
            },
          };
        }
      } catch {
        // ID no vÃ¡lido (no UUID), continuar con otros mÃ©todos
      }
    }

    // ========================================
    // PRIORIDAD 2: Buscar por code
    // ========================================
    if (code) {
      const result = await this.aedRepository.findByCode(code);
      if (result && result.isDuplicate) {
        return {
          isDuplicate: true,
          existingId: result.matchedAedId,
          metadata: {
            matchedBy: "code",
            matchedCode: result.matchedCode,
            matchedExternalReference: result.matchedExternalReference,
            skipDuplicates: this.skipDuplicates,
          },
        };
      }
    }

    // ========================================
    // PRIORIDAD 3: Buscar por external_reference
    // ========================================
    if (externalRef) {
      const result = await this.aedRepository.findByExternalReference(externalRef);
      if (result && result.isDuplicate) {
        return {
          isDuplicate: true,
          existingId: result.matchedAedId,
          metadata: {
            matchedBy: "externalReference",
            matchedCode: result.matchedCode,
            matchedExternalReference: result.matchedExternalReference,
            skipDuplicates: this.skipDuplicates,
          },
        };
      }
    }

    // No se encontrÃ³ ningÃºn duplicado
    return { isDuplicate: false };
  }

  /**
   * Batch-optimized duplicate check: 3 queries max for an entire batch
   * instead of up to 3N individual queries.
   *
   * Strategy:
   * 1. Collect all IDs, codes, and external references from the batch
   * 2. Run 3 batch queries (findByIds, findByCodes, findByExternalReferences)
   * 3. Match results back to each record using cascade priority: ID → Code → ExternalRef
   */
  async checkBatch(
    records: readonly { fields: Record<string, unknown>; context: ProcessingContext }[]
  ): Promise<readonly BulkImportDuplicateResult[]> {
    // 1. Collect all identifiers from the batch
    const allIds: string[] = [];
    const allCodes: string[] = [];
    const allExternalRefs: string[] = [];

    const recordIdentifiers = records.map(({ fields }) => {
      const id = this.extractString(fields, "id");
      const code = this.extractString(fields, "code");
      const externalRef = this.extractString(fields, "externalReference");

      if (id) allIds.push(id);
      if (code) allCodes.push(code);
      if (externalRef) allExternalRefs.push(externalRef);

      return { id, code, externalRef };
    });

    // 2. Run batch queries (max 3 queries regardless of batch size)
    const [idMatches, codeMatches, refMatches] = await Promise.all([
      allIds.length > 0 ? this.aedRepository.findByIds(allIds) : new Map(),
      allCodes.length > 0 ? this.aedRepository.findByCodes(allCodes) : new Map(),
      allExternalRefs.length > 0
        ? this.aedRepository.findByExternalReferences(allExternalRefs)
        : new Map(),
    ]);

    // 3. Match results back to each record using cascade priority
    return recordIdentifiers.map(({ id, code, externalRef }) => {
      // No identifiers → not a duplicate
      if (!id && !code && !externalRef) {
        return { isDuplicate: false };
      }

      // Priority 1: Match by ID
      if (id) {
        const match = idMatches.get(id);
        if (match) {
          return {
            isDuplicate: true,
            existingId: match.matchedAedId,
            metadata: {
              matchedBy: "id",
              matchedCode: match.matchedCode,
              matchedExternalReference: match.matchedExternalReference,
              skipDuplicates: this.skipDuplicates,
            },
          };
        }
      }

      // Priority 2: Match by code
      if (code) {
        const match = codeMatches.get(code.toLowerCase());
        if (match) {
          return {
            isDuplicate: true,
            existingId: match.matchedAedId,
            metadata: {
              matchedBy: "code",
              matchedCode: match.matchedCode,
              matchedExternalReference: match.matchedExternalReference,
              skipDuplicates: this.skipDuplicates,
            },
          };
        }
      }

      // Priority 3: Match by external reference
      if (externalRef) {
        const match = refMatches.get(externalRef.toLowerCase());
        if (match) {
          return {
            isDuplicate: true,
            existingId: match.matchedAedId,
            metadata: {
              matchedBy: "externalReference",
              matchedCode: match.matchedCode,
              matchedExternalReference: match.matchedExternalReference,
              skipDuplicates: this.skipDuplicates,
            },
          };
        }
      }

      return { isDuplicate: false };
    });
  }

  /**
   * Extrae un string limpio de los fields del record
   */
  private extractString(fields: Record<string, unknown>, key: string): string | undefined {
    const value = fields[key];
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str || undefined;
  }
}
