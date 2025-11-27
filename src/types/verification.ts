export enum VerificationStep {
  ADDRESS_VALIDATION = 'address_validation',
  IMAGE_SELECTION = 'image_selection',
  IMAGE_CROP_FRONT = 'image_crop_front',
  IMAGE_ARROW_FRONT = 'image_arrow_front',
  IMAGE_CROP_INTERIOR = 'image_crop_interior',
  IMAGE_ARROW_INTERIOR = 'image_arrow_interior',
  RESPONSIBLE_ASSIGNMENT = 'responsible_assignment',
  REVIEW = 'review',
  COMPLETED = 'completed'
}

export interface VerificationSession {
  id: string;
  aed_id: string;
  user_id: string;
  current_step: VerificationStep;
  status: 'in_progress' | 'completed' | 'cancelled';

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

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  thickness?: number;
}

export const VERIFICATION_STEPS_CONFIG = {
  [VerificationStep.ADDRESS_VALIDATION]: {
    title: 'Validación de Dirección',
    description: 'Verifica la dirección del DEA con Google Maps u OpenStreetMap',
    required: true
  },
  [VerificationStep.IMAGE_SELECTION]: {
    title: 'Selección de Imágenes',
    description: 'Selecciona las imágenes del frontal/acceso y del interior',
    required: true
  },
  [VerificationStep.IMAGE_CROP_FRONT]: {
    title: 'Recortar Imagen Frontal',
    description: 'Recorta la imagen del frontal o acceso al DEA',
    required: true
  },
  [VerificationStep.IMAGE_ARROW_FRONT]: {
    title: 'Marcar DEA en Imagen Frontal',
    description: 'Coloca una flecha señalando el DEA en la imagen frontal',
    required: true
  },
  [VerificationStep.IMAGE_CROP_INTERIOR]: {
    title: 'Recortar Imagen Interior',
    description: 'Recorta la imagen del interior donde se ubica el DEA',
    required: false
  },
  [VerificationStep.IMAGE_ARROW_INTERIOR]: {
    title: 'Marcar DEA en Imagen Interior',
    description: 'Coloca una flecha señalando el DEA en la imagen interior',
    required: false
  },
  [VerificationStep.RESPONSIBLE_ASSIGNMENT]: {
    title: 'Asignar Responsable',
    description: 'Asigna la entidad responsable y persona de contacto',
    required: true
  },
  [VerificationStep.REVIEW]: {
    title: 'Revisión Final',
    description: 'Revisa toda la información antes de finalizar',
    required: true
  },
  [VerificationStep.COMPLETED]: {
    title: 'Completado',
    description: 'La verificación ha sido completada exitosamente',
    required: false
  }
};
