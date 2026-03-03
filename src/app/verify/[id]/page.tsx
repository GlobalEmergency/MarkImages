"use client";

import type {
  Aed,
  AedLocation,
  AedImage,
  AedResponsible,
  AedValidation,
} from "@/generated/client/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import dynamic from "next/dynamic";

import AddressValidation from "@/components/verification/AddressValidation";
import ArrowPlacer from "@/components/verification/ArrowPlacer";
import ConfirmDialog from "@/components/ConfirmDialog";
import DeaInfoEdit from "@/components/verification/DeaInfoEdit";
import ImageCropper from "@/components/verification/ImageCropper";

// Lazy-load ImageBlur — it pulls in @vladmandic/face-api (~3 MB)
const ImageBlur = dynamic(() => import("@/components/verification/ImageBlur"), {
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="animate-spin h-8 w-8" />
      <span className="ml-2">Cargando editor de difuminado...</span>
    </div>
  ),
  ssr: false,
});
import ImageMultiSelector from "@/components/verification/ImageMultiSelector";
import ResponsibleForm from "@/components/verification/ResponsibleForm";
import { useAuth } from "@/contexts/AuthContext";
import type { CropData, ArrowData, BlurArea } from "@/types/shared";
import type {
  AddressData,
  ResponsibleData,
  ValidatedImageData,
  ProcessedImageData,
  ImageProcessingState,
} from "@/types/verification";
import { VerificationStep, VERIFICATION_STEPS_CONFIG } from "@/types/verification";

interface VerificationData {
  aed: Aed & {
    location: AedLocation | null;
    images: AedImage[];
    responsible: AedResponsible | null;
  };
  validation: AedValidation;
  current_step: VerificationStep;
}

interface VerifyPageProps {
  params: Promise<{ id: string }>;
}

// Temporary image URLs (blob:/data:) are kept client-side only so they
// never bloat the JSON payload sent to the server on each step update.
interface LocalImageUrls {
  /** blob: URL produced by ImageCropper */
  croppedImageUrl?: string;
  /** blob: URL produced by ImageBlur */
  blurredImageUrl?: string;
  /** data: URL per processed image (keyed by image_id), produced by ArrowPlacer for preview */
  processedUrls: Record<string, string>;
}

export default function VerifyPage({ params }: VerifyPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  // Client-only temp image URLs — never sent to the server
  const [localImageUrls, setLocalImageUrls] = useState<LocalImageUrls>({ processedUrls: {} });
  // Background save indicator (non-blocking)
  const [savingStep, setSavingStep] = useState(false);
  // Lightbox for image preview in REVIEW step
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify");
      return;
    }

    if (!authLoading && user && !user.is_verified) {
      router.push("/");
      return;
    }

    if (user) {
      fetchVerificationData();
    }
  }, [authLoading, user, resolvedParams.id, router]);

  const fetchVerificationData = async () => {
    try {
      console.log("=== Fetching verification data ===");
      const response = await fetch(`/api/verify/${resolvedParams.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Sesión de verificación no encontrada");
        }
        throw new Error("Error al cargar sesión");
      }

      const responseData = await response.json();
      console.log("=== Verification data received ===");
      console.log("Current step from API:", responseData.current_step);
      console.log("Full response data:", responseData);

      setData(responseData);
      console.log("=== State updated with new data ===");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (step: VerificationStep, stepData?: Record<string, unknown>) => {
    if (!data) return;

    // ── Optimistic update: render the next step immediately ──
    const mergedData = {
      ...((data.validation.data as object) || {}),
      ...stepData,
      current_step: step,
    };

    setData({
      ...data,
      validation: { ...data.validation, data: mergedData },
      current_step: step,
    });

    // ── Persist to server in the background (non-blocking) ──
    setSavingStep(true);
    fetch(`/api/verify/${resolvedParams.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data: stepData || {} }),
    })
      .then(async (response) => {
        if (!response.ok) {
          console.error("Background save failed:", response.status);
          // Show a transient warning but don't block the user
          setSavingStep(false);
          return;
        }
        await response.json(); // consume body
      })
      .catch((err) => {
        console.error("Background save error:", err);
      })
      .finally(() => setSavingStep(false));
  };

  const completeVerification = async () => {
    setCompleting(true);

    // ── Optimistic: show the COMPLETED screen immediately ──
    setData((prev) =>
      prev
        ? {
            ...prev,
            current_step: VerificationStep.COMPLETED,
            validation: {
              ...prev.validation,
              data: {
                ...((prev.validation.data as object) || {}),
                current_step: VerificationStep.COMPLETED,
              },
            },
          }
        : prev
    );

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Error al completar verificación");
      }

      // Redirect to verify list after short delay
      setTimeout(() => {
        router.push("/verify");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al completar verificación");
      // Revert to REVIEW on failure
      setData((prev) =>
        prev
          ? {
              ...prev,
              current_step: VerificationStep.REVIEW,
              validation: {
                ...prev.validation,
                data: {
                  ...((prev.validation.data as object) || {}),
                  current_step: VerificationStep.REVIEW,
                },
              },
            }
          : prev
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelVerification = async () => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al cancelar verificación");
      }

      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar verificación");
    } finally {
      setShowCancelDialog(false);
    }
  };

  const handleRejectDea = async (reason?: string) => {
    if (!reason) return;

    try {
      setLoading(true);

      // Update AED status to REJECTED with the reason
      const response = await fetch(`/api/aeds/${resolvedParams.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "REJECTED",
          rejection_reason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al rechazar DEA");
      }

      // Cancel the verification session
      await fetch(`/api/verify/${resolvedParams.id}`, {
        method: "DELETE",
      });

      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al rechazar DEA");
    } finally {
      setLoading(false);
      setShowRejectDialog(false);
    }
  };

  const getStepProgress = () => {
    if (!data) return { current: 0, total: 0, percentage: 0 };

    const steps = Object.keys(VERIFICATION_STEPS_CONFIG).filter(
      (step) => step !== VerificationStep.COMPLETED
    );
    const currentIndex = steps.indexOf(data.current_step);

    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: Math.round(((currentIndex + 1) / steps.length) * 100),
    };
  };

  const renderStepContent = () => {
    if (!data) return null;

    console.log("=== Rendering step content ===");
    console.log("Current step:", data.current_step);

    const stepConfig = VERIFICATION_STEPS_CONFIG[data.current_step];

    switch (data.current_step) {
      case VerificationStep.ADDRESS_VALIDATION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <AddressValidation
              _aedId={data.aed.id}
              currentAddress={{
                street_type: data.aed.location?.street_type ?? undefined,
                street_name: data.aed.location?.street_name ?? undefined,
                street_number: data.aed.location?.street_number ?? undefined,
                additional_info: data.aed.location?.location_details ?? undefined,
                postal_code: data.aed.location?.postal_code ?? undefined,
                latitude: data.aed.latitude ?? undefined,
                longitude: data.aed.longitude ?? undefined,
                coordinates_precision: data.aed.coordinates_precision ?? undefined,
                city_name: data.aed.location?.city_name ?? undefined,
                city_code: data.aed.location?.city_code ?? undefined,
                district_code: data.aed.location?.district_code ?? undefined,
                district_name: data.aed.location?.district_name ?? undefined,
                neighborhood_code: data.aed.location?.neighborhood_code ?? undefined,
                neighborhood_name: data.aed.location?.neighborhood_name ?? undefined,
                access_description: data.aed.location?.access_instructions ?? undefined,
                floor: data.aed.location?.floor ?? undefined,
                specific_location: data.aed.location?.location_details ?? undefined,
              }}
              observations={undefined}
              onValidationComplete={(validatedAddress: AddressData) => {
                updateStep(VerificationStep.IMAGE_SELECTION, {
                  validated_address: validatedAddress,
                });
              }}
            />
          </div>
        );

      case VerificationStep.IMAGE_SELECTION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ImageMultiSelector
              images={data.aed.images.map((img) => ({
                id: img.id,
                original_url: img.original_url,
                type: img.type || undefined,
                order: img.order,
              }))}
              descripcionAcceso={data.aed.location?.access_instructions || undefined}
              onValidationComplete={async (result) => {
                try {
                  // IDs of images the user marked as valid (existing images)
                  const validImageIds = new Set(result.validImages.map((img) => img.id));
                  let finalImages: AedImage[] = data.aed.images;

                  // Persist image changes (add/delete) if needed — single PATCH, no extra GETs
                  const hasChanges =
                    result.deletedImageIds.length > 0 ||
                    (result.newImages && result.newImages.length > 0);
                  if (hasChanges) {
                    const response = await fetch(`/api/aeds/${resolvedParams.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        deleteImageIds: result.deletedImageIds,
                        addImages: result.newImages?.map((img) => ({
                          original_url: img.url,
                          order: img.order,
                          type: img.type,
                        })),
                      }),
                    });

                    if (!response.ok) {
                      throw new Error("Error al actualizar las imágenes");
                    }

                    // Use the PATCH response directly — it already contains updated images
                    const updatedAed = await response.json();
                    finalImages = updatedAed.images || [];

                    // Sync local data so subsequent steps see the fresh image list
                    setData((prev) =>
                      prev ? { ...prev, aed: { ...prev.aed, images: finalImages } } : prev
                    );
                  }

                  // Build the list of images to process:
                  // - existing images the user marked valid (by ID)
                  // - newly added images (not in the original set)
                  const originalIds = new Set(data.aed.images.map((img) => img.id));
                  const allValidImages = finalImages.filter(
                    (img) => validImageIds.has(img.id) || !originalIds.has(img.id)
                  );

                  if (allValidImages.length > 0) {
                    const validatedImages: ValidatedImageData[] = allValidImages.map((img) => ({
                      id: img.id,
                      url: img.original_url,
                      order: img.order,
                      type: img.type || "FRONT",
                    }));

                    updateStep(VerificationStep.IMAGE_CROP, {
                      validated_images: validatedImages,
                      current_image_index: 0,
                      processed_images: [],
                    });
                  } else {
                    updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                      validated_images: [],
                      processed_images: [],
                      images_invalid: true,
                    });
                  }
                } catch (err) {
                  console.error("Error processing images:", err);
                  setError(err instanceof Error ? err.message : "Error al procesar las imágenes");
                }
              }}
              onCancel={() => updateStep(VerificationStep.ADDRESS_VALIDATION)}
            />
          </div>
        );

      case VerificationStep.IMAGE_CROP: {
        // Obtener el estado de procesamiento de imágenes
        const validationData = data.validation.data as ImageProcessingState | null;
        const validatedImages = validationData?.validated_images || [];
        const currentIndex = validationData?.current_image_index || 0;
        const currentImage = validatedImages[currentIndex];

        if (!currentImage) {
          console.error("No current image found for cropping");
          return null;
        }

        const imageNumber = currentIndex + 1;
        const totalImages = validatedImages.length;

        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">{stepConfig.title}</h2>
              <p className="text-gray-600 mt-2">{stepConfig.description}</p>
              <div className="mt-2 text-sm text-blue-600 font-medium">
                Procesando imagen {imageNumber} de {totalImages} - Tipo: {currentImage.type}
              </div>
            </div>

            <ImageCropper
              imageUrl={currentImage.url}
              onCropChange={(_cropData: CropData) => {
                // Track crop changes
              }}
              onCropComplete={async (cropData: CropData, croppedImageUrl?: string) => {
                // Keep the blob: URL client-side only (never send to server)
                setLocalImageUrls((prev) => ({
                  ...prev,
                  croppedImageUrl: croppedImageUrl || currentImage.url,
                }));
                // Only send the lightweight crop coordinates to the server
                updateStep(VerificationStep.IMAGE_BLUR, {
                  ...validationData,
                  current_crop_data: cropData,
                });
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_SELECTION)}
            />
          </div>
        );
      }

      case VerificationStep.IMAGE_BLUR: {
        // Obtener el estado de procesamiento de imágenes
        const validationData = data.validation.data as
          | (ImageProcessingState & {
              current_crop_data?: CropData;
            })
          | null;
        const validatedImages = validationData?.validated_images || [];
        const currentIndex = validationData?.current_image_index || 0;
        const currentImage = validatedImages[currentIndex];
        const currentCropData = validationData?.current_crop_data;
        // Use client-side blob: URL from crop step (never stored on server)
        const currentCroppedImageUrl = localImageUrls.croppedImageUrl;

        if (!currentImage) {
          console.error("No current image found for blur");
          return null;
        }

        const imageNumber = currentIndex + 1;
        const totalImages = validatedImages.length;

        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">{stepConfig.title}</h2>
              <p className="text-gray-600 mt-2">{stepConfig.description}</p>
              <div className="mt-2 text-sm text-blue-600 font-medium">
                Procesando imagen {imageNumber} de {totalImages} - Tipo: {currentImage.type}
              </div>
            </div>

            <ImageBlur
              imageUrl={currentCroppedImageUrl || currentImage.url}
              onBlurComplete={async (blurAreas: BlurArea[], blurredImageUrl?: string) => {
                // Keep blob: URL client-side only
                setLocalImageUrls((prev) => ({
                  ...prev,
                  blurredImageUrl: blurredImageUrl || currentCroppedImageUrl || currentImage.url,
                }));
                // Only send lightweight blur coordinates to the server
                updateStep(VerificationStep.IMAGE_ARROW, {
                  ...validationData,
                  current_crop_data: currentCropData,
                  current_blur_areas: blurAreas,
                });
              }}
              onSkip={async () => {
                // Continue without blur — carry forward cropped image URL locally
                setLocalImageUrls((prev) => ({
                  ...prev,
                  blurredImageUrl: currentCroppedImageUrl || currentImage.url,
                }));
                updateStep(VerificationStep.IMAGE_ARROW, {
                  ...validationData,
                  current_crop_data: currentCropData,
                  current_blur_areas: [],
                });
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_CROP)}
            />
          </div>
        );
      }

      case VerificationStep.IMAGE_ARROW: {
        // Obtener el estado de procesamiento de imágenes
        const validationData = data.validation.data as
          | (ImageProcessingState & {
              current_crop_data?: CropData;
              current_blur_areas?: BlurArea[];
            })
          | null;
        const validatedImages = validationData?.validated_images || [];
        const currentIndex = validationData?.current_image_index || 0;
        const processedImages = validationData?.processed_images || [];
        const currentImage = validatedImages[currentIndex];
        const currentCropData = validationData?.current_crop_data;
        const currentBlurAreas = validationData?.current_blur_areas || [];
        // Use client-side blob: URL from blur step (never stored on server)
        const currentBlurredImageUrl = localImageUrls.blurredImageUrl;

        if (!currentImage) {
          console.error("No current image found for arrow placement");
          return null;
        }

        const imageNumber = currentIndex + 1;
        const totalImages = validatedImages.length;

        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">{stepConfig.title}</h2>
              <p className="text-gray-600 mt-2">{stepConfig.description}</p>
              <div className="mt-2 text-sm text-blue-600 font-medium">
                Procesando imagen {imageNumber} de {totalImages} - Tipo: {currentImage.type}
              </div>
            </div>

            <ArrowPlacer
              imageUrl={currentBlurredImageUrl || currentImage.url}
              onArrowComplete={async (arrowData: ArrowData, processedImageUrl?: string) => {
                // Keep the data: URL for preview client-side only
                if (processedImageUrl) {
                  setLocalImageUrls((prev) => ({
                    ...prev,
                    processedUrls: { ...prev.processedUrls, [currentImage.id]: processedImageUrl },
                  }));
                }

                // Only send lightweight coordinates to the server (NO image data)
                const newProcessedImage: ProcessedImageData = {
                  image_id: currentImage.id,
                  crop_data: currentCropData,
                  blur_areas: currentBlurAreas.length > 0 ? currentBlurAreas : undefined,
                  arrow_data: arrowData,
                  // processed_url deliberately omitted — kept client-side only
                };

                const updatedProcessedImages = [...processedImages, newProcessedImage];

                // Reset per-image temp URLs for the next image
                setLocalImageUrls((prev) => ({
                  ...prev,
                  croppedImageUrl: undefined,
                  blurredImageUrl: undefined,
                }));

                // Verificar si hay más imágenes por procesar
                const nextIndex = currentIndex + 1;
                if (nextIndex < validatedImages.length) {
                  // Hay más imágenes, procesar la siguiente
                  updateStep(VerificationStep.IMAGE_CROP, {
                    validated_images: validatedImages,
                    current_image_index: nextIndex,
                    processed_images: updatedProcessedImages,
                  });
                } else {
                  // Ya se procesaron todas las imágenes, continuar a responsable
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    validated_images: validatedImages,
                    processed_images: updatedProcessedImages,
                  });
                }
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_BLUR)}
            />
          </div>
        );
      }

      case VerificationStep.RESPONSIBLE_ASSIGNMENT:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ResponsibleForm
              _aedId={data.aed.id}
              currentResponsible={
                data.aed.responsible
                  ? {
                      id: data.aed.responsible.id,
                      name: data.aed.responsible.name,
                      email: data.aed.responsible.email ?? undefined,
                      phone: data.aed.responsible.phone ?? undefined,
                      alternative_phone: data.aed.responsible.alternative_phone ?? undefined,
                      organization: data.aed.responsible.organization ?? undefined,
                      position: data.aed.responsible.position ?? undefined,
                      department: data.aed.responsible.department ?? undefined,
                      observations: undefined,
                    }
                  : undefined
              }
              onAssignmentComplete={(responsibleData: ResponsibleData) => {
                updateStep(VerificationStep.REVIEW, {
                  responsible_data: responsibleData,
                });
              }}
            />

            <div className="flex justify-start mt-6">
              <button
                onClick={() => updateStep(VerificationStep.IMAGE_SELECTION)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
              >
                Anterior
              </button>
            </div>
          </div>
        );

      case VerificationStep.REVIEW: {
        // Obtener imágenes validadas y procesadas desde validation.data
        const validationData = data.validation.data as ImageProcessingState | null;
        const validatedImages = validationData?.validated_images || [];
        const processedImages = validationData?.processed_images || [];

        // Agrupar por tipo
        const frontImages = validatedImages.filter((img) => img.type === "FRONT");
        const interiorImages = validatedImages.filter((img) => img.type !== "FRONT");

        // Función auxiliar para obtener info de procesamiento e imagen procesada
        const getImageProcessing = (imageId: string) => {
          const processed = processedImages.find((p) => p.image_id === imageId);
          return {
            hasCrop: !!processed?.crop_data,
            hasBlur: !!(processed?.blur_areas && processed.blur_areas.length > 0),
            hasArrow: !!processed?.arrow_data,
            // Use client-side preview URL (data: URL kept in local state, not on server)
            processedUrl: localImageUrls.processedUrls[imageId],
          };
        };

        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            {/* Review summary */}
            <div className="space-y-6 mb-6">
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Información del DEA</h3>
                <p className="text-sm text-gray-700">
                  <strong>Nombre:</strong> {data.aed.name}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Código:</strong> {data.aed.code || "Sin asignar"}
                </p>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Dirección Validada</h3>
                <p className="text-sm text-gray-700">
                  {data.aed.location?.street_type} {data.aed.location?.street_name}{" "}
                  {data.aed.location?.street_number}
                </p>
                {data.aed.location?.district_name && (
                  <p className="text-sm text-gray-700">
                    Distrito: {data.aed.location.district_name}
                  </p>
                )}
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Imágenes Verificadas</h3>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Total: {validatedImages.length} imagen(es)</strong>
                  {frontImages.length > 0 && ` • ${frontImages.length} frontal(es)`}
                  {interiorImages.length > 0 && ` • ${interiorImages.length} interior(es)`}
                </p>

                {/* Gallery of validated images */}
                {validatedImages.length > 0 ? (
                  <div className="space-y-4">
                    {/* Front images */}
                    {frontImages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">
                          Imágenes Frontales
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {frontImages.map((img) => {
                            const processing = getImageProcessing(img.id);
                            // Usar imagen procesada si existe, si no usar original
                            const displayUrl = processing.processedUrl || img.url;
                            return (
                              <div key={img.id} className="group relative">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                  <img
                                    src={displayUrl}
                                    alt={`Frontal ${img.order}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                                    onClick={() => setLightboxUrl(displayUrl)}
                                  />
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {processing.hasCrop && (
                                    <span
                                      className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                      title="Recortada"
                                    >
                                      ✂️
                                    </span>
                                  )}
                                  {processing.hasBlur && (
                                    <span
                                      className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
                                      title="Difuminada"
                                    >
                                      🔒
                                    </span>
                                  )}
                                  {processing.hasArrow && (
                                    <span
                                      className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                                      title="Con flecha"
                                    >
                                      🎯
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Interior images */}
                    {interiorImages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">
                          Imágenes de Interior
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {interiorImages.map((img) => {
                            const processing = getImageProcessing(img.id);
                            // Usar imagen procesada si existe, si no usar original
                            const displayUrl = processing.processedUrl || img.url;
                            return (
                              <div key={img.id} className="group relative">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                  <img
                                    src={displayUrl}
                                    alt={`Interior ${img.order}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                                    onClick={() => setLightboxUrl(displayUrl)}
                                  />
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {processing.hasCrop && (
                                    <span
                                      className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                      title="Recortada"
                                    >
                                      ✂️
                                    </span>
                                  )}
                                  {processing.hasBlur && (
                                    <span
                                      className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
                                      title="Difuminada"
                                    >
                                      🔒
                                    </span>
                                  )}
                                  {processing.hasArrow && (
                                    <span
                                      className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                                      title="Con flecha"
                                    >
                                      🎯
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No se procesaron imágenes en esta verificación
                  </div>
                )}
              </div>

              {data.aed.responsible && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Responsable</h3>
                  <p className="text-sm text-gray-700">
                    <strong>Nombre:</strong> {data.aed.responsible.name}
                  </p>
                  {data.aed.responsible.email && (
                    <p className="text-sm text-gray-700">
                      <strong>Email:</strong> {data.aed.responsible.email}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
              >
                Anterior
              </button>
              <button
                onClick={completeVerification}
                disabled={completing}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {completing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Completando...
                  </>
                ) : (
                  "Completar Verificación"
                )}
              </button>
            </div>

            {/* Lightbox modal for image preview */}
            {lightboxUrl && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setLightboxUrl(null)}
              >
                <button
                  className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-2xl hover:bg-black/70"
                  onClick={() => setLightboxUrl(null)}
                >
                  ✕
                </button>
                <img
                  src={lightboxUrl}
                  alt="Vista ampliada"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );
      }

      case VerificationStep.COMPLETED:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="w-20 h-20 text-green-500 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">✅ Verificación Completada</h2>
              <p className="text-gray-600 mb-6">El DEA ha sido verificado exitosamente.</p>
              <div className="text-sm text-gray-500">
                <p>Redirigiendo a la lista...</p>
                <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2" />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig?.title || "Cargando..."}</h2>
            <p className="text-gray-600">{stepConfig?.description || "Procesando paso..."}</p>
          </div>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando verificación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/verify")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Volver a Verificaciones
          </button>
        </div>
      </div>
    );
  }

  if (!user || !data) {
    return null;
  }

  const progress = getStepProgress();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Verificación de DEA</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium text-sm transition-colors"
              >
                Rechazar DEA
              </button>
              <button
                onClick={() => setShowCancelDialog(true)}
                className="text-gray-600 hover:text-gray-700 font-medium text-sm"
              >
                Cancelar Verificación
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Paso {progress.current} de {progress.total}
              </span>
              <div className="flex items-center gap-2">
                {savingStep && (
                  <span className="flex items-center text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Guardando...
                  </span>
                )}
                <span className="text-sm text-gray-500">{progress.percentage}% completado</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* DEA Information - Editable */}
        <div className="mb-6">
          <DeaInfoEdit
            aedId={data.aed.id}
            initialData={{
              code: data.aed.code,
              provisional_number: data.aed.provisional_number,
              name: data.aed.name,
              establishment_type: data.aed.establishment_type,
              location: data.aed.location
                ? {
                    street_type: data.aed.location.street_type,
                    street_name: data.aed.location.street_name,
                    street_number: data.aed.location.street_number,
                    district_name: data.aed.location.district_name,
                  }
                : null,
              status: data.aed.status,
              images_count: data.aed.images.length,
            }}
            onUpdate={fetchVerificationData}
          />
        </div>

        {/* Step Content */}
        {renderStepContent()}

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          isOpen={showCancelDialog}
          title="Cancelar Verificación"
          message="¿Estás seguro de que quieres cancelar la verificación? Se perderá todo el progreso actual."
          confirmText="Sí, cancelar"
          cancelText="No, continuar"
          confirmColor="red"
          onConfirm={handleCancelVerification}
          onCancel={() => setShowCancelDialog(false)}
        />

        <ConfirmDialog
          isOpen={showRejectDialog}
          title="Rechazar DEA"
          message="Por favor, indica el motivo por el cual deseas rechazar este DEA. Esta acción marcará el DEA como rechazado y cancelará la verificación."
          confirmText="Rechazar DEA"
          cancelText="Cancelar"
          confirmColor="red"
          requiresInput
          inputLabel="Motivo del rechazo *"
          inputPlaceholder="Ej: Datos insuficientes, información incorrecta, duplicado..."
          onConfirm={handleRejectDea}
          onCancel={() => setShowRejectDialog(false)}
        />
      </div>
    </div>
  );
}
