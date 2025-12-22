/**
 * Puerto: Servicio de normalización de texto
 * Capa de Dominio - Interface
 * 
 * Define el contrato para normalizar texto independientemente de la implementación.
 * Permite tener diferentes estrategias (JavaScript, PostgreSQL, etc.)
 */

export interface ITextNormalizationService {
  /**
   * Normaliza un texto para comparación:
   * - Minúsculas
   * - Sin acentos
   * - Sin espacios extra
   * - Sin puntuación
   * 
   * @param text Texto a normalizar
   * @returns Texto normalizado
   */
  normalize(text: string | null | undefined): string;

  /**
   * Normaliza una dirección completa
   * Combina tipo de vía, nombre y número en un formato estándar
   * 
   * @param streetType Tipo de vía (Calle, Avenida, etc.)
   * @param streetName Nombre de la vía
   * @param streetNumber Número
   * @returns Dirección normalizada
   */
  normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string;
}
