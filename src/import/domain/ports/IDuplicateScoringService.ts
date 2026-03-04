/**
 * Puerto: Servicio de scoring de duplicados
 * Capa de Dominio - Interface
 *
 * Define el contrato para calcular scores de duplicados.
 * Permite diferentes implementaciones (JavaScript, PostgreSQL, etc.)
 */

export interface AedComparisonData {
  name: string;
  streetType?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  provisionalNumber?: number | null;
  establishmentType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationDetails?: string | null;
  accessInstructions?: string | null;
  floor?: string | null;
}

export interface ScoringWeights {
  // Pesos para campos que suman puntos
  nameSimilarity: number;
  addressMatch: number;
  coordinatesProximity: number;
  provisionalNumberMatch: number;
  establishmentTypeMatch: number;
  postalCodeMatch: number;

  // Pesos para campos que restan puntos (diferencias)
  accessInstructionsDiff: number;
  locationDetailsDiff: number;
  floorDiff: number;
}

export interface IDuplicateScoringService {
  /**
   * Calcula el score de duplicado entre dos DEAs
   *
   * @param aed1 Primer DEA a comparar
   * @param aed2 Segundo DEA a comparar
   * @param weights Pesos personalizados (opcional)
   * @returns Score de 0-100 puntos (mayor = más probable que sea duplicado)
   */
  calculateScore(
    aed1: AedComparisonData,
    aed2: AedComparisonData,
    weights?: Partial<ScoringWeights>
  ): Promise<number>;

  /**
   * Determina si un score indica que dos DEAs son duplicados
   *
   * @param score Score calculado (0-100)
   * @param threshold Umbral personalizado (opcional)
   * @returns true si el score indica duplicado
   */
  isDuplicate(score: number, threshold?: number): boolean;

  /**
   * Genera un mensaje explicativo del score calculado
   * Útil para debugging y logs
   *
   * @param aed1 Primer DEA
   * @param aed2 Segundo DEA
   * @param score Score calculado
   * @returns Explicación detallada del score
   */
  explainScore(aed1: AedComparisonData, aed2: AedComparisonData, score: number): Promise<string>;
}
