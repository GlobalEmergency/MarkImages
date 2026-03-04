import type { CropData, ArrowData, BlurArea } from "./shared";

export enum VerificationStep {
  ADDRESS_VALIDATION = "address_validation",
  IMAGE_SELECTION = "image_selection",
  IMAGE_CROP = "image_crop",
  IMAGE_BLUR = "image_blur",
  IMAGE_ARROW = "image_arrow",
  RESPONSIBLE_ASSIGNMENT = "responsible_assignment",
  REVIEW = "review",
  COMPLETED = "completed",
}

export interface VerificationSession {
  id: string;
  aed_id: string;
  user_id: string;
  current_step: VerificationStep;
  status: "in_progress" | "completed" | "cancelled";

  // Address validation data
  address_validated: boolean;
  selected_address?: AddressData;

  // Image data
  front_image_id?: string;
  front_image_url?: string;
  front_image_cropped_url?: string;
  front_image_processed_url?: string;

  interior_image_ids?: string[];
  interior_image_urls?: string[];
  interior_image_cropped_urls?: string[];
  interior_image_processed_urls?: string[];

  // Responsible data
  responsible_id?: string;
  responsible_data?: ResponsibleData;

  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface AddressData {
  street_type?: string;
  street_name?: string;
  street_number?: string;
  postal_code?: string;
  district_id?: number;
  district_name?: string;
  latitude?: number;
  longitude?: number;
  confidence?: number;
}

export interface ResponsibleData {
  name: string;
  email?: string;
  phone?: string;
  alternative_phone?: string;
  ownership?: string;
  local_ownership?: string;
  local_use?: string;
  organization?: string;
  position?: string;
  department?: string;
  observations?: string;
}

// Multi-image validation types
export interface ImageValidationItem {
  id: string;
  url: string;
  order: number;
  isValid: boolean;
  type?: string;
}

export interface ImagesValidationResult {
  validImages: ImageValidationItem[];
  deletedImageIds: string[];
  newImages?: Array<{
    url: string;
    order: number;
    type?: string;
  }>;
}

// Sequential image processing types
export interface ValidatedImageData {
  id: string;
  url: string;
  order: number;
  type: string;
}

export interface ProcessedImageData {
  image_id: string;
  crop_data?: CropData;
  blur_areas?: BlurArea[];
  arrow_data?: ArrowData;
  processed_url?: string; // URL temporal (data URL) de la imagen procesada para preview
}

export interface ImageProcessingState {
  validated_images: ValidatedImageData[];
  current_image_index: number;
  processed_images: ProcessedImageData[];
}

export const VERIFICATION_STEPS_CONFIG = {
  [VerificationStep.ADDRESS_VALIDATION]: {
    title: "Validación de Dirección",
    description: "Verifica la dirección del DEA con Google Maps u OpenStreetMap",
    required: true,
  },
  [VerificationStep.IMAGE_SELECTION]: {
    title: "Selección de Imágenes",
    description: "Selecciona las imágenes del frontal/acceso y del interior",
    required: true,
  },
  [VerificationStep.IMAGE_CROP]: {
    title: "Recortar Imagen",
    description: "Recorta la imagen seleccionada",
    required: true,
  },
  [VerificationStep.IMAGE_BLUR]: {
    title: "Difuminar Áreas Sensibles",
    description: "Difumina caras, matrículas u otras áreas sensibles (opcional)",
    required: false,
  },
  [VerificationStep.IMAGE_ARROW]: {
    title: "Marcar DEA en Imagen",
    description: "Coloca una flecha señalando el DEA en la imagen",
    required: true,
  },
  [VerificationStep.RESPONSIBLE_ASSIGNMENT]: {
    title: "Asignar Responsable",
    description: "Asigna la entidad responsable y persona de contacto",
    required: true,
  },
  [VerificationStep.REVIEW]: {
    title: "Revisión Final",
    description: "Revisa toda la información antes de finalizar",
    required: true,
  },
  [VerificationStep.COMPLETED]: {
    title: "Completado",
    description: "La verificación ha sido completada exitosamente",
    required: false,
  },
};
