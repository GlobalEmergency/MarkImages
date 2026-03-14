/**
 * Puerto: Transformador de campos
 * Capa de Dominio - Interface para transformar valores de texto libre
 * en campos estructurados (ej: "DE 07:30 A 15:00" → weekdayOpening/Closing)
 */

/**
 * Resultado de una transformación de campo
 */
export interface TransformerResult {
  /** Campos normalizados producidos por el transformer */
  fields: Record<string, string | null>;
  /** Confianza del resultado (0-1). Si 0, el fallback del fieldMapping se mantiene */
  confidence: number;
  /** Valor original del campo antes de transformar */
  rawValue: string;
}

/**
 * Puerto: Transformador de campo individual
 * Implementaciones: SpanishScheduleParser, LibpostalAddressTransformer
 */
export interface IFieldTransformer {
  /** Nombre único del transformer (ej: "spanish-schedule", "libpostal-address") */
  readonly name: string;

  /**
   * Transforma un valor de texto libre en campos estructurados
   *
   * @param value - Valor a transformar (ya trimmed)
   * @param context - Resultado del transformer anterior en la cadena (para chaining)
   * @returns Resultado con campos parseados y nivel de confianza
   */
  transform(value: string, context?: Record<string, string | null>): Promise<TransformerResult>;
}
