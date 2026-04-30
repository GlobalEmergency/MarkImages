/**
 * Image Types for AED System
 * Based on Prisma schema enum AedImageType
 */

export enum AedImageType {
  FRONT = "FRONT",
  LOCATION = "LOCATION",
  ACCESS = "ACCESS",
  SIGNAGE = "SIGNAGE",
  CONTEXT = "CONTEXT",
  PLATE = "PLATE",
}

export const IMAGE_TYPE_LABELS: Record<AedImageType, string> = {
  [AedImageType.FRONT]: "Frontal del DEA",
  [AedImageType.LOCATION]: "UbicaciÃ³n Exterior",
  [AedImageType.ACCESS]: "Acceso al Lugar",
  [AedImageType.SIGNAGE]: "SeÃ±alizaciÃ³n",
  [AedImageType.CONTEXT]: "Contexto General",
  [AedImageType.PLATE]: "Placa/InformaciÃ³n",
};

export const IMAGE_TYPE_OPTIONS = Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => ({
  value: value as AedImageType,
  label,
}));
