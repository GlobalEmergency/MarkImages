/**
 * Utilidad compartida para enriquecer registros con TransformerPipeline
 * Usada por JsonFileAdapter, RestApiAdapter, CsvDataSourceAdapter y CkanApiAdapter
 */

import { TransformerPipeline } from "../transformers/TransformerPipeline";
import { registerAllTransformers } from "../transformers";
import { normalizeRecord } from "./normalizeRecord";

let cachedPipeline: TransformerPipeline | null = null;

function getPipeline(): TransformerPipeline {
  if (!cachedPipeline) {
    cachedPipeline = new TransformerPipeline(registerAllTransformers());
  }
  return cachedPipeline;
}

/**
 * Normaliza el record (aplana nested objects, parsea WKT) y si hay
 * fieldTransformers configurados, enriquece aplicando transformers.
 */
export async function enrichRecordIfNeeded(
  record: Record<string, unknown>,
  fieldMappings: Record<string, string>,
  fieldTransformers?: Record<string, string | string[]>
): Promise<{ record: Record<string, unknown>; mappings: Record<string, string> }> {
  // Always normalize: flatten nested objects, parse WKT POINT, etc.
  const normalized = normalizeRecord(record);

  if (!fieldTransformers) {
    return { record: normalized, mappings: fieldMappings };
  }

  const pipeline = getPipeline();
  const { enrichedRecord, enrichedMappings } = await pipeline.enrichRecord(
    normalized,
    fieldTransformers,
    fieldMappings
  );
  return { record: enrichedRecord, mappings: enrichedMappings };
}
