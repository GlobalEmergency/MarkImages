"use client";

import type { Aed, AedLocation, AedImage, AedResponsible, AedValidation } from "@/generated/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import AddressValidation from "@/components/verification/AddressValidation";
import ArrowPlacer from "@/components/verification/ArrowPlacer";
import ConfirmDialog from "@/components/ConfirmDialog";
import ImageCropper from "@/components/verification/ImageCropper";
import ImagePairSelector, { ImageSelection } from "@/components/verification/ImagePairSelector";
import ResponsibleForm from "@/components/verification/ResponsibleForm";
import { useAuth } from "@/contexts/AuthContext";
import type { CropData, ArrowData } from "@/types/shared";
import type { AddressData, ResponsibleData } from "@/types/verification";
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

export default function VerifyPage({ params }: VerifyPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify");
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

  const updateStep = async (step: VerificationStep, stepData?: Record<string, unknown>) => {
    console.log("=== updateStep called ===");
    console.log("Step:", step);
    console.log("Step data:", stepData);

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ step, data: stepData || {} }),
      });

      console.log("Update response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Update error response:", errorData);
        throw new Error("Error al actualizar paso");
      }

      const updatedValidation = await response.json();
      console.log("Update successful, response:", updatedValidation);

      // Extract current_step from the updated validation data
      const validationData = updatedValidation.data as {
        current_step?: string;
        user_id?: string;
      } | null;
      const newStep = validationData?.current_step || VerificationStep.ADDRESS_VALIDATION;

      console.log("New step from PUT response:", newStep);

      // Update state directly with the new step (avoid GET request and caching issues)
      if (data) {
        const updatedData = {
          ...data,
          validation: updatedValidation,
          current_step: newStep as VerificationStep,
        };
        console.log("Updating state with new step:", newStep);
        setData(updatedData);
        console.log("State updated successfully");
      }
    } catch (err) {
      console.error("Error in updateStep:", err);
      setError(err instanceof Error ? err.message : "Error al actualizar paso");
    }
  };

  const completeVerification = async () => {
    setCompleting(true);
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
                postal_code: data.aed.location?.postal_code ?? undefined,
                latitude: data.aed.location?.latitude ?? undefined,
                longitude: data.aed.location?.longitude ?? undefined,
              }}
              observations={data.aed.origin_observations ?? undefined}
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

            <ImagePairSelector
              image1Url={data.aed.images[0]?.original_url}
              image2Url={data.aed.images[1]?.original_url}
              descripcionAcceso={data.aed.location?.access_description || undefined}
              onSelectionComplete={(selection: ImageSelection) => {
                // Determine next step based on selection
                if (selection.markedAsInvalid) {
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    images_invalid: true,
                  });
                } else if (selection.image1Valid) {
                  updateStep(VerificationStep.IMAGE_CROP_FRONT, {
                    image_selection: selection,
                  });
                } else {
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    images_invalid: true,
                  });
                }
              }}
              onUploadNewImages={async (image1Url: string | null, image2Url: string | null) => {
                // Update AED with new images
                const imageUrls = [image1Url, image2Url].filter(Boolean) as string[];

                try {
                  const response = await fetch(`/api/aeds/${resolvedParams.id}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      images: imageUrls.map((url, index) => ({
                        original_url: url,
                        order: index,
                      })),
                    }),
                  });

                  if (!response.ok) {
                    throw new Error("Error al actualizar las imágenes");
                  }

                  // Refresh verification data to show new images
                  await fetchVerificationData();
                } catch (err) {
                  console.error("Error uploading new images:", err);
                  setError(err instanceof Error ? err.message : "Error al subir las imágenes");
                }
              }}
              onCancel={() => updateStep(VerificationStep.ADDRESS_VALIDATION)}
            />
          </div>
        );

      case VerificationStep.IMAGE_CROP_FRONT:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ImageCropper
              imageUrl={data.aed.images[0]?.original_url || ""}
              onCropChange={(_cropData: CropData) => {
                // Track crop changes
              }}
              onCropComplete={async (cropData: CropData) => {
                // TODO: Call API to process cropped image
                updateStep(VerificationStep.IMAGE_ARROW_FRONT, {
                  front_crop_data: cropData,
                });
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_SELECTION)}
            />
          </div>
        );

      case VerificationStep.IMAGE_ARROW_FRONT:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ArrowPlacer
              imageUrl={data.aed.images[0]?.original_url || ""} // TODO: Use cropped image
              onArrowComplete={async (arrowData: ArrowData) => {
                // Determine if there's a second image
                const hasSecondImage = data.aed.images.length > 1;
                if (hasSecondImage) {
                  updateStep(VerificationStep.IMAGE_CROP_INTERIOR, {
                    front_arrow_data: arrowData,
                  });
                } else {
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    front_arrow_data: arrowData,
                  });
                }
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_CROP_FRONT)}
            />
          </div>
        );

      case VerificationStep.IMAGE_CROP_INTERIOR:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ImageCropper
              imageUrl={data.aed.images[1]?.original_url || ""}
              onCropChange={(_cropData: CropData) => {
                // Track interior crop changes
              }}
              onCropComplete={async (cropData: CropData) => {
                updateStep(VerificationStep.IMAGE_ARROW_INTERIOR, {
                  interior_crop_data: cropData,
                });
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_ARROW_FRONT)}
            />
          </div>
        );

      case VerificationStep.IMAGE_ARROW_INTERIOR:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <ArrowPlacer
              imageUrl={data.aed.images[1]?.original_url || ""} // TODO: Use cropped image
              onArrowComplete={async (arrowData: ArrowData) => {
                updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                  interior_arrow_data: arrowData,
                });
              }}
              onCancel={() => updateStep(VerificationStep.IMAGE_CROP_INTERIOR)}
            />
          </div>
        );

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
                      observations: data.aed.responsible.observations ?? undefined,
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

      case VerificationStep.REVIEW:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            {/* Review summary */}
            <div className="space-y-4 mb-6">
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
                <h3 className="font-semibold text-lg mb-2">Imágenes</h3>
                <p className="text-sm text-gray-700">
                  {data.aed.images.length} imagen(es) procesada(s)
                </p>
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
          </div>
        );

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
              <span className="text-sm text-gray-500">{progress.percentage}% completado</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* DEA Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del DEA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Código</p>
              <p className="font-medium text-gray-900">
                {data.aed.code ||
                  (data.aed.provisional_number ? `#${data.aed.provisional_number}` : "Sin código")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium text-gray-900">{data.aed.name}</p>
            </div>
            {data.aed.establishment_type && (
              <div>
                <p className="text-sm text-gray-500">Tipo de establecimiento</p>
                <p className="font-medium text-gray-900">{data.aed.establishment_type}</p>
              </div>
            )}
            {data.aed.location && (
              <div>
                <p className="text-sm text-gray-500">Ubicación</p>
                <p className="font-medium text-gray-900">
                  {data.aed.location.street_type} {data.aed.location.street_name}{" "}
                  {data.aed.location.street_number}
                  {data.aed.location.district_name && ` - ${data.aed.location.district_name}`}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {data.aed.status === "DRAFT" ? "Borrador" : "Pendiente de revisión"}
              </span>
            </div>
            {data.aed.images && data.aed.images.length > 0 && (
              <div>
                <p className="text-sm text-gray-500">Imágenes</p>
                <p className="font-medium text-gray-900">{data.aed.images.length} imagen(es)</p>
              </div>
            )}
          </div>
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
