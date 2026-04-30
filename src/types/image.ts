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
  [AedImageType.LOCATION]: "Ubicación Exterior",
  [AedImageType.ACCESS]: "Acceso al Lugar",
  [AedImageType.SIGNAGE]: "Señalización",
  [AedImageType.CONTEXT]: "Contexto General",
  [AedImageType.PLATE]: "Placa/Información",
};

export const IMAGE_TYPE_OPTIONS = Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => ({
  value: value as AedImageType,
  label,
}));
