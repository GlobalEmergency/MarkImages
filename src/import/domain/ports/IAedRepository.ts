/**
 * AED Repository Port (Domain Interface)
 *
 * Puerto de dominio para acceso a datos de AEDs.
 * Sigue el principio de Dependency Inversion (DIP).
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedBy?: "id" | "code" | "externalReference";
  matchedAedId?: string;
  matchedCode?: string | null;
  matchedExternalReference?: string | null;
}

export interface IAedRepository {
  /**
   * Verifica si existe un AED con el ID dado
   */
  existsById(id: string): Promise<boolean>;

  /**
   * Verifica si existe un AED con el cÃ³digo dado
   */
  findByCode(code: string): Promise<DuplicateCheckResult | null>;

  /**
   * Verifica si existe un AED con la referencia externa dada
   */
  findByExternalReference(externalRef: string): Promise<DuplicateCheckResult | null>;

  /**
   * Busca un AED por ID y retorna informaciÃ³n bÃ¡sica
   */
  findById(id: string): Promise<DuplicateCheckResult | null>;

  /**
   * Busca AEDs por mÃºltiples IDs en una sola query.
   * Retorna un Map de id â†’ DuplicateCheckResult para los encontrados.
   */
  findByIds(ids: string[]): Promise<Map<string, DuplicateCheckResult>>;

  /**
   * Busca AEDs por mÃºltiples cÃ³digos en una sola query.
   * Retorna un Map de code (lowercase) â†’ DuplicateCheckResult para los encontrados.
   */
  findByCodes(codes: string[]): Promise<Map<string, DuplicateCheckResult>>;

  /**
   * Busca AEDs por mÃºltiples referencias externas en una sola query.
   * Retorna un Map de externalReference (lowercase) â†’ DuplicateCheckResult para los encontrados.
   */
  findByExternalReferences(refs: string[]): Promise<Map<string, DuplicateCheckResult>>;
}
