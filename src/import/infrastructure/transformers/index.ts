/**
 * Registro de transformadores disponibles
 * Importar este módulo para registrar todos los transformers en el singleton
 */

import { TransformerRegistry } from "./TransformerRegistry";
import { SpanishScheduleParser } from "@/import/domain/services/SpanishScheduleParser";
import { FrenchScheduleParser } from "@/import/domain/services/FrenchScheduleParser";
import { GermanScheduleParser } from "@/import/domain/services/GermanScheduleParser";
import { ViennaAddressParser } from "@/import/domain/services/ViennaAddressParser";
import { AddressNumberSplitter } from "@/import/domain/services/AddressNumberSplitter";
import { ColonNameSplitter } from "@/import/domain/services/ColonNameSplitter";
import { HtmlStripTransformer } from "@/import/domain/services/HtmlStripTransformer";
import { LibpostalAddressTransformer } from "./LibpostalAddressTransformer";
import { NominatimGeocodingTransformer } from "./NominatimGeocodingTransformer";

export function registerAllTransformers(): TransformerRegistry {
  const registry = TransformerRegistry.getInstance();

  if (!registry.has("spanish-schedule")) {
    registry.register(new SpanishScheduleParser());
  }

  if (!registry.has("french-schedule")) {
    registry.register(new FrenchScheduleParser());
  }

  if (!registry.has("german-schedule")) {
    registry.register(new GermanScheduleParser());
  }

  if (!registry.has("vienna-address")) {
    registry.register(new ViennaAddressParser());
  }

  if (!registry.has("address-number-split")) {
    registry.register(new AddressNumberSplitter());
  }

  if (!registry.has("colon-name-split")) {
    registry.register(new ColonNameSplitter());
  }

  if (!registry.has("html-strip")) {
    registry.register(new HtmlStripTransformer());
  }

  if (!registry.has("libpostal-address")) {
    registry.register(new LibpostalAddressTransformer());
  }

  if (!registry.has("nominatim-geocode")) {
    registry.register(new NominatimGeocodingTransformer());
  }

  return registry;
}
