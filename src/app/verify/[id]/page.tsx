'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Aed, AedLocation, AedImage, AedResponsible, AedValidation, District, Neighborhood, Street } from '@prisma/client';
import { Loader2 } from 'lucide-react';

import AddressValidation from '@/components/verification/AddressValidation';
import ArrowPlacer from '@/components/verification/ArrowPlacer';
import ImageCropper from '@/components/verification/ImageCropper';
import ImagePairSelector, { ImageSelection } from '@/components/verification/ImagePairSelector';
import ResponsibleForm from '@/components/verification/ResponsibleForm';
import { useAuth } from '@/contexts/AuthContext';
import type { CropData, ArrowData } from '@/types/shared';
import type { AddressData, ResponsibleData } from '@/types/verification';
import { VerificationStep, VERIFICATION_STEPS_CONFIG } from '@/types/verification';

interface VerificationData {
  aed: Aed & {
    location: (AedLocation & {
      district: District | null;
      neighborhood: Neighborhood | null;
      street: Street | null;
    }) | null;
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
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/verify');
      return;
    }

    if (user) {
      fetchVerificationData();
    }
  }, [authLoading, user, resolvedParams.id, router]);

  const fetchVerificationData = async () => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Sesión de verificación no encontrada');
        }
        throw new Error('Error al cargar sesión');
      }

      const responseData = await response.json();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const updateStep = async (step: VerificationStep, stepData?: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step, data: stepData || {} }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar paso');
      }

      // Refresh data
      await fetchVerificationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar paso');
    }
  };

  const completeVerification = async () => {
    setCompleting(true);
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al completar verificación');
      }

      // Redirect to verify list after short delay
      setTimeout(() => {
        router.push('/verify');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar verificación');
    } finally {
      setCompleting(false);
    }
  };

  const cancelVerification = async () => {
    if (!confirm('¿Estás seguro de que quieres cancelar la verificación?')) {
      return;
    }

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al cancelar verificación');
      }

      router.push('/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar verificación');
    }
  };

  const getStepProgress = () => {
    if (!data) return { current: 0, total: 0, percentage: 0 };

    const steps = Object.keys(VERIFICATION_STEPS_CONFIG).filter(
      step => step !== VerificationStep.COMPLETED
    );
    const currentIndex = steps.indexOf(data.current_step);

    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: Math.round(((currentIndex + 1) / steps.length) * 100)
    };
  };

  const renderStepContent = () => {
    if (!data) return null;

    const stepConfig = VERIFICATION_STEPS_CONFIG[data.current_step];

    switch (data.current_step) {
      case VerificationStep.ADDRESS_VALIDATION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">{stepConfig.title}</h2>
            <p className="text-gray-600 mb-6">{stepConfig.description}</p>

            <AddressValidation
              aedId={data.aed.id}
              currentAddress={{
                street_type: data.aed.location?.street_type,
                street_name: data.aed.location?.street_name,
                street_number: data.aed.location?.street_number,
                postal_code: data.aed.location?.postal_code,
                latitude: data.aed.location?.latitude,
                longitude: data.aed.location?.longitude
              }}
              onValidationComplete={(validatedAddress: AddressData) => {
                updateStep(VerificationStep.IMAGE_SELECTION, {
                  validated_address: validatedAddress
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
                    images_invalid: true
                  });
                } else if (selection.image1Valid) {
                  updateStep(VerificationStep.IMAGE_CROP_FRONT, {
                    image_selection: selection
                  });
                } else {
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    images_invalid: true
                  });
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
              imageUrl={data.aed.images[0]?.original_url || ''}
              onCropChange={(_cropData: CropData) => {
                // Track crop changes
              }}
              onCropComplete={async (cropData: CropData) => {
                // TODO: Call API to process cropped image
                updateStep(VerificationStep.IMAGE_ARROW_FRONT, {
                  front_crop_data: cropData
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
              imageUrl={data.aed.images[0]?.original_url || ''} // TODO: Use cropped image
              onArrowComplete={async (arrowData: ArrowData) => {
                // Determine if there's a second image
                const hasSecondImage = data.aed.images.length > 1;
                if (hasSecondImage) {
                  updateStep(VerificationStep.IMAGE_CROP_INTERIOR, {
                    front_arrow_data: arrowData
                  });
                } else {
                  updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                    front_arrow_data: arrowData
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
              imageUrl={data.aed.images[1]?.original_url || ''}
              onCropChange={(_cropData: CropData) => {
                // Track interior crop changes
              }}
              onCropComplete={async (cropData: CropData) => {
                updateStep(VerificationStep.IMAGE_ARROW_INTERIOR, {
                  interior_crop_data: cropData
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
              imageUrl={data.aed.images[1]?.original_url || ''} // TODO: Use cropped image
              onArrowComplete={async (arrowData: ArrowData) => {
                updateStep(VerificationStep.RESPONSIBLE_ASSIGNMENT, {
                  interior_arrow_data: arrowData
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
              aedId={data.aed.id}
              currentResponsible={data.aed.responsible || undefined}
              onAssignmentComplete={(responsibleData: ResponsibleData) => {
                updateStep(VerificationStep.REVIEW, {
                  responsible_data: responsibleData
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
                  <strong>Código:</strong> {data.aed.code || 'Sin asignar'}
                </p>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Dirección Validada</h3>
                <p className="text-sm text-gray-700">
                  {data.aed.location?.street_type} {data.aed.location?.street_name}{' '}
                  {data.aed.location?.street_number}
                </p>
                {data.aed.location?.district && (
                  <p className="text-sm text-gray-700">
                    Distrito: {data.aed.location.district.name}
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
                  'Completar Verificación'
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
                <svg className="w-20 h-20 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                ✅ Verificación Completada
              </h2>
              <p className="text-gray-600 mb-6">
                El DEA ha sido verificado exitosamente.
              </p>
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
            <h2 className="text-2xl font-bold mb-4">
              {stepConfig?.title || 'Cargando...'}
            </h2>
            <p className="text-gray-600">
              {stepConfig?.description || 'Procesando paso...'}
            </p>
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
            onClick={() => router.push('/verify')}
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
            <h1 className="text-3xl font-bold text-gray-900">
              Verificación de DEA
            </h1>
            <button
              onClick={cancelVerification}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Cancelar
            </button>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Paso {progress.current} de {progress.total}
              </span>
              <span className="text-sm text-gray-500">
                {progress.percentage}% completado
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </div>
  );
}
