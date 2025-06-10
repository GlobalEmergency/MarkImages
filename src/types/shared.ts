// src/types/shared.ts

export interface CropperConfig {
  aspectRatio?: number;          // 1 para cuadrado, 16/9 para rectangular, etc.
  outputSize?: {
    width: number;
    height: number;
  };
  allowZoom?: boolean;
  allowRotation?: boolean;
  minCropSize?: number;
  maxCropSize?: number;
}

export interface ArrowConfig {
  startPosition?: 'bottom' | 'top' | 'left' | 'right' | 'custom';
  color?: string;
  width?: number;
  headLength?: number;
  headWidth?: number;
  allowMultiple?: boolean;
  maxArrows?: number;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

export interface ArrowData {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  width: number;
}

export interface ImageProcessingStep {
  id: string;
  type: 'crop' | 'arrow' | 'filter' | 'resize';
  config: CropperConfig | ArrowConfig | Record<string, unknown>;
  completed: boolean;
  data?: CropData | ArrowData | Record<string, unknown>;
}

export interface StepContainerProps {
  title: string;
  description?: string;
  stepNumber: number;
  totalSteps: number;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  showSkip?: boolean;
}

export interface FlowProgress {
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  percentage: number;
}

// Props para hooks
export interface UseImageCropperProps {
  config: CropperConfig;
  onCropComplete: (croppedImage: string, cropData: CropData) => void;
  onError?: (error: string) => void;
}

export interface UseArrowMarkerProps {
  config: ArrowConfig;
  imageUrl: string;
  onArrowComplete: (arrows: ArrowData[]) => void;
  onError?: (error: string) => void;
}

export interface UseStepFlowProps {
  steps: string[];
  initialStep?: string;
  onStepChange?: (step: string, direction: 'next' | 'previous') => void;
  onComplete?: () => void;
}
