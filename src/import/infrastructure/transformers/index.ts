/**
 * Registro de transformadores disponibles
 * Importar este módulo para registrar todos los transformers en el singleton
 */

import { TransformerRegistry } from "./TransformerRegistry";
import { SpanishScheduleParser } from "@/import/domain/services/SpanishScheduleParser";
import { LibpostalAddressTransformer } from "./LibpostalAddressTransformer";
import { NominatimGeocodingTransformer } from "./NominatimGeocodingTransformer";

export function registerAllTransformers(): TransformerRegistry {
  const registry = TransformerRegistry.getInstance();

  if (!registry.has("spanish-schedule")) {
    registry.register(new SpanishScheduleParser());
  }

  if (!registry.has("libpostal-address")) {
    registry.register(new LibpostalAddressTransformer());
  }

  if (!registry.has("nominatim-geocode")) {
    registry.register(new NominatimGeocodingTransformer());
  }

  return registry;
}
