// src/types/verification.ts
import { DeaRecord } from './index';

export interface VerificationSession {
  id: number;
  deaRecordId: number;
  status: VerificationStatus;
  currentStep: VerificationStep;
  stepData?: Record<string, unknown>; // JSON data for step-by-step validation progress
  originalImageUrl?: string;
  croppedImageUrl?: string;
  processedImageUrl?: string;
  secondImageUrl?: string;
  secondCroppedImageUrl?: string;
  secondProcessedImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deaRecord?: DeaRecord;
  arrowMarkers?: ArrowMarker[];
  processedImages?: ProcessedImage[];
}

export interface ArrowMarker {
  id: number;
  verificationSessionId: number;
  imageNumber: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  arrowColor: string;
  arrowWidth: number;
  createdAt: string;
}

export interface ProcessedImage {
  id: number;
  verificationSessionId: number;
  originalFilename: string;
  processedFilename: string;
  imageType: ImageType;
  fileSize: number;
  dimensions: string;
  createdAt: string;
}

export enum VerificationStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum VerificationStep {
  DATA_VALIDATION = 'data_validation',
  DEA_INFO = 'dea_info',
  IMAGE_CROP_1 = 'image_crop_1',
  ARROW_PLACEMENT_1 = 'arrow_placement_1',
  IMAGE_VALIDATION_2 = 'image_validation_2',
  IMAGE_CROP_2 = 'image_crop_2',
  ARROW_PLACEMENT_2 = 'arrow_placement_2',
  REVIEW = 'review',
  COMPLETED = 'completed'
}

export enum ImageType {
  CROPPED = 'cropped',
  WITH_ARROW = 'with_arrow',
  THUMBNAIL = 'thumbnail'
}

// Configuración de pasos
export interface StepConfig {
  title: string;
  description: string;
  component: string;
  allowSkip: boolean;
  config?: import('./shared').CropperConfig | import('./shared').ArrowConfig | Record<string, unknown>;
}

export const VERIFICATION_STEPS_CONFIG: Record<VerificationStep, StepConfig> = {
  [VerificationStep.DATA_VALIDATION]: {
    title: 'Validación de Datos',
    description: 'Valida y corrige los datos del DEA',
    component: 'DataValidationStep',
    allowSkip: false
  },
  [VerificationStep.DEA_INFO]: {
    title: 'Información del DEA',
    description: 'Revisa los datos del desfibrilador',
    component: 'DeaInfoStep',
    allowSkip: false
  },
  [VerificationStep.IMAGE_CROP_1]: {
    title: 'Recortar Primera Imagen',
    description: 'Selecciona el área cuadrada de la imagen',
    component: 'ImageCropStep',
    allowSkip: false,
    config: {
      aspectRatio: 1,
      outputSize: { width: 1000, height: 1000 }
    }
  },
  [VerificationStep.ARROW_PLACEMENT_1]: {
    title: 'Colocar Flecha Indicadora',
    description: 'Marca la ubicación del DEA',
    component: 'ArrowPlacementStep',
    allowSkip: false,
    config: {
      startPosition: 'bottom',
      color: '#dc2626',
      allowMultiple: false
    }
  },
  [VerificationStep.IMAGE_VALIDATION_2]: {
    title: 'Validar Segunda Imagen',
    description: 'Verifica si la segunda imagen es válida',
    component: 'ImageValidationStep',
    allowSkip: false
  },
  [VerificationStep.IMAGE_CROP_2]: {
    title: 'Recortar Segunda Imagen',
    description: 'Selecciona el área cuadrada de la segunda imagen',
    component: 'ImageCropStep',
    allowSkip: false,
    config: {
      aspectRatio: 1,
      outputSize: { width: 1000, height: 1000 }
    }
  },
  [VerificationStep.ARROW_PLACEMENT_2]: {
    title: 'Colocar Flecha en Segunda Imagen',
    description: 'Marca la ubicación del DEA con origen seleccionable',
    component: 'ArrowPlacementWithOriginStep',
    allowSkip: false,
    config: {
      startPosition: 'selectable',
      color: '#dc2626',
      allowMultiple: false
    }
  },
  [VerificationStep.REVIEW]: {
    title: 'Revisar y Confirmar',
    description: 'Revisa todos los cambios antes de guardar',
    component: 'ReviewStep',
    allowSkip: false
  },
  [VerificationStep.COMPLETED]: {
    title: 'Completado',
    description: 'Verificación completada exitosamente',
    component: 'CompletedStep',
    allowSkip: false
  }
};
