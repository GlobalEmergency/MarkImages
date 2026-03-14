/**
 * Utilidad compartida para enriquecer registros con TransformerPipeline
 * Usada por JsonFileAdapter, RestApiAdapter y CkanApiAdapter
 */

import { TransformerPipeline } from "../transformers/TransformerPipeline";
import { registerAllTransformers } from "../transformers";

let cachedPipeline: TransformerPipeline | null = null;

function getPipeline(): TransformerPipeline {
  if (!cachedPipeline) {
    cachedPipeline = new TransformerPipeline(registerAllTransformers());
  }
  return cachedPipeline;
}

/**
 * Si hay fieldTransformers configurados, enriquece el record aplicando
 * los transformers. Si no, devuelve record y mappings sin cambios.
 */
export async function enrichRecordIfNeeded(
  record: Record<string, unknown>,
  fieldMappings: Record<string, string>,
  fieldTransformers?: Record<string, string | string[]>
): Promise<{ record: Record<string, unknown>; mappings: Record<string, string> }> {
  if (!fieldTransformers) {
    return { record, mappings: fieldMappings };
  }

  const pipeline = getPipeline();
  const { enrichedRecord, enrichedMappings } = await pipeline.enrichRecord(
    record,
    fieldTransformers,
    fieldMappings
  );
  return { record: enrichedRecord, mappings: enrichedMappings };
}
