/**
 * DeaImageProcessor - Reusable image processing pipeline for DEA images
 * Chains: CROP → BLUR → ARROW for a single image
 * Used by any user with permissions on the DEA (admin, verifier, etc.)
 *
 * After client-side processing, sends metadata to server for Sharp-based processing.
 */

"use client";

import { useState, useCallback } from "react";
import { X, ChevronRight } from "lucide-react";
import ImageCropper from "@/components/verification/ImageCropper";
import ImageBlur from "@/components/verification/ImageBlur";
import ArrowPlacer from "@/components/verification/ArrowPlacer";
import type { CropData, ArrowData, BlurArea } from "@/types/shared";

type ProcessingStep = "crop" | "blur" | "arrow" | "done";

export interface ImageProcessingResult {
  cropData?: CropData;
  blurAreas?: BlurArea[];
  arrowData?: ArrowData;
  previewUrl?: string; // Client-side preview (data URL from arrow step)
}

interface DeaImageProcessorProps {
  /** URL of the image to process (original_url for existing, data URL for new) */
  imageUrl: string;
  /** Image ID (for existing images) */
  imageId?: string;
  /** Label shown in header */
  imageLabel?: string;
  /** Called when user completes or cancels */
  onComplete: (result: ImageProcessingResult | null) => void;
  /** Called during processing to show/hide the modal */
  onCancel: () => void;
}

export default function DeaImageProcessor({
  imageUrl,
  imageId: _imageId,
  imageLabel = "Imagen",
  onComplete,
  onCancel,
}: DeaImageProcessorProps) {
  const [step, setStep] = useState<ProcessingStep>("crop");
  const [cropData, setCropData] = useState<CropData | undefined>();
  const [blurAreas, setBlurAreas] = useState<BlurArea[]>([]);
  const [_arrowData, setArrowData] = useState<ArrowData | undefined>();

  // Client-side preview URLs for chaining
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [blurredUrl, setBlurredUrl] = useState<string | null>(null);

  // ── Step handlers ──

  const handleCropComplete = useCallback((crop: CropData, croppedImageUrl?: string) => {
    setCropData(crop);
    if (croppedImageUrl) setCroppedUrl(croppedImageUrl);
    setStep("blur");
  }, []);

  const handleCropCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleBlurComplete = useCallback((areas: BlurArea[], blurredImageUrl?: string) => {
    setBlurAreas(areas);
    if (blurredImageUrl) setBlurredUrl(blurredImageUrl);
    setStep("arrow");
  }, []);

  const handleBlurSkip = useCallback(() => {
    setBlurAreas([]);
    setStep("arrow");
  }, []);

  const handleBlurCancel = useCallback(() => {
    // Go back to crop
    setCroppedUrl(null);
    setCropData(undefined);
    setStep("crop");
  }, []);

  const handleArrowComplete = useCallback(
    (arrow: ArrowData, processedImageUrl?: string) => {
      setArrowData(arrow);
      setStep("done");

      onComplete({
        cropData,
        blurAreas,
        arrowData: arrow,
        previewUrl: processedImageUrl || blurredUrl || croppedUrl || undefined,
      });
    },
    [cropData, blurAreas, blurredUrl, croppedUrl, onComplete]
  );

  const handleArrowCancel = useCallback(() => {
    // Go back to blur
    setBlurredUrl(null);
    setBlurAreas([]);
    setStep("blur");
  }, []);

  // Determine which image to show in current step
  const getImageForStep = (): string => {
    switch (step) {
      case "crop":
        return imageUrl;
      case "blur":
        return croppedUrl || imageUrl;
      case "arrow":
        return blurredUrl || croppedUrl || imageUrl;
      default:
        return imageUrl;
    }
  };

  const stepLabels: Record<ProcessingStep, string> = {
    crop: "Recortar",
    blur: "Difuminar",
    arrow: "Flecha",
    done: "Listo",
  };

  const stepNumber: Record<ProcessingStep, number> = {
    crop: 1,
    blur: 2,
    arrow: 3,
    done: 4,
  };

  if (step === "done") return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Procesar: {imageLabel}</h3>
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1 text-sm">
              {(["crop", "blur", "arrow"] as ProcessingStep[]).map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      step === s
                        ? "bg-blue-100 text-blue-700"
                        : stepNumber[step] > stepNumber[s]
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {stepNumber[s]}. {stepLabels[s]}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {step === "crop" && (
            <ImageCropper
              imageUrl={getImageForStep()}
              onCropChange={() => {}}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          )}

          {step === "blur" && (
            <ImageBlur
              imageUrl={getImageForStep()}
              onBlurComplete={handleBlurComplete}
              onSkip={handleBlurSkip}
              onCancel={handleBlurCancel}
            />
          )}

          {step === "arrow" && (
            <ArrowPlacer
              imageUrl={getImageForStep()}
              onArrowComplete={handleArrowComplete}
              onCancel={handleArrowCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
