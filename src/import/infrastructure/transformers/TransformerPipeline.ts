/**
 * Orquestador de transformadores de campos
 * Capa de Infraestructura
 *
 * Enriquece un raw record aplicando transformers configurados.
 * Los campos parseados se añaden al record con prefijo _t_ y se crean
 * identity mappings para ellos. Como applyFieldMappings procesa en orden,
 * los transformer mappings (al final) sobreescriben los del fieldMapping original.
 *
 * Si un transformer falla, el fieldMapping original queda intacto (fallback).
 */

import type { TransformerResult } from "@/import/domain/ports/IFieldTransformer";
import { TransformerRegistry } from "./TransformerRegistry";

export class TransformerPipeline {
  constructor(private registry: TransformerRegistry) {}

  /**
   * Enriquece un record aplicando transformers configurados
   *
   * @param record - Record crudo de la fuente de datos
   * @param fieldTransformers - Mapa: campo fuente → nombre(s) de transformer
   * @param fieldMappings - Mapa original: campo fuente → campo normalizado
   * @returns Record enriquecido + mappings augmentados
   */
  async enrichRecord(
    record: Record<string, unknown>,
    fieldTransformers: Record<string, string | string[]>,
    fieldMappings: Record<string, string>
  ): Promise<{
    enrichedRecord: Record<string, unknown>;
    enrichedMappings: Record<string, string>;
  }> {
    const enrichedRecord = { ...record };
    const enrichedMappings = { ...fieldMappings };

    // Build base context from mapped field values so transformers can read
    // already-mapped fields (e.g., geocoding reads streetType, city, etc.).
    // Existing transformers ignore context, so this is backward-compatible.
    const baseContext: Record<string, string | null> = {};
    for (const [srcField, targetField] of Object.entries(fieldMappings)) {
      const val = record[srcField];
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        baseContext[targetField] = str || null;
      }
    }

    for (const [sourceField, transformerNames] of Object.entries(fieldTransformers)) {
      const rawValue = record[sourceField];
      if (rawValue === undefined || rawValue === null) continue;

      const valueStr = String(rawValue).trim();
      if (!valueStr) continue;

      const names = Array.isArray(transformerNames) ? transformerNames : [transformerNames];
      let mergedFields: Record<string, string | null> = { ...baseContext };
      let lastResult: TransformerResult | null = null;

      for (const name of names) {
        const transformer = this.registry.get(name);
        if (!transformer) {
          console.warn(`⚠️ Transformer '${name}' no registrado, ignorando`);
          continue;
        }

        try {
          lastResult = await transformer.transform(valueStr, mergedFields);
          if (lastResult.confidence > 0) {
            mergedFields = { ...mergedFields, ...lastResult.fields };
          }
        } catch (error) {
          console.warn(
            `⚠️ Transformer '${name}' falló para campo '${sourceField}': ${error instanceof Error ? error.message : error}`
          );
          break; // Parar cadena en error, mantener fallback
        }
      }

      // Añadir campos producidos por transformers al record con prefijo _t_.
      // Solo añadir campos que no estaban en baseContext o que fueron modificados.
      for (const [normalizedField, value] of Object.entries(mergedFields)) {
        if (value !== null && value !== undefined && value !== baseContext[normalizedField]) {
          const tempKey = `_t_${normalizedField}`;
          enrichedRecord[tempKey] = value;
          enrichedMappings[tempKey] = normalizedField;
        }
      }
    }

    return { enrichedRecord, enrichedMappings };
  }
}
