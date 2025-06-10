'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { VerificationStep, VERIFICATION_STEPS_CONFIG } from '@/types/verification';
import type { VerificationSession } from '@/types/verification';
import type { CropData, ArrowData } from '@/types/shared';
import ImageCropper from '@/components/verification/ImageCropper';
import ArrowPlacer from '@/components/verification/ArrowPlacer';
import ImageValidator from '@/components/verification/ImageValidator';
import ArrowPlacerWithOrigin from '@/components/verification/ArrowPlacerWithOrigin';
import DeaValidationPanel from '@/components/validation/DeaValidationPanel';

interface VerificationPageProps {
  params: Promise<{ id: string }>;
}

export default function VerificationPage({ params }: VerificationPageProps) {
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    fetchSession();
  }, [resolvedParams.id]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Sesión de verificación no encontrada');
        }
        throw new Error('Error al cargar sesión');
      }
      const data = await response.json();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const updateStep = async (step: VerificationStep) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar paso');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar paso');
    }
  };

  const completeVerification = async () => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al completar verificación');
      }

      // Redirigir a la página principal después de completar
      router.push('/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar verificación');
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

  const handleCropChange = (_cropData: CropData) => {
    // This function is kept for compatibility with ImageCropper component
    // The cropData is handled directly in handleCropComplete
  };

  const handleCropComplete = async (cropData: CropData) => {
    if (!session?.originalImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/crop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: session.originalImageUrl,
          cropData
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar imagen recortada');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
      
      // Avanzar al siguiente paso
      await updateStep(VerificationStep.ARROW_PLACEMENT_1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imagen');
    }
  };

  const handleCropCancel = () => {
    updateStep(VerificationStep.DEA_INFO);
  };

  const handleArrowComplete = async (arrowData: ArrowData) => {
    if (!session?.croppedImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/arrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arrowData }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar flecha');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
      
      // Avanzar al siguiente paso - validación de segunda imagen
      await updateStep(VerificationStep.IMAGE_VALIDATION_2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar flecha');
    }
  };

  const handleArrowCancel = () => {
    updateStep(VerificationStep.IMAGE_CROP_1);
  };

  // Handlers para la segunda imagen
  const handleImageValidation = async (isValid: boolean) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/validate-image2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isValid }),
      });

      if (!response.ok) {
        throw new Error('Error al validar imagen');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      if (isValid) {
        // Si es válida, continuar al recorte de la segunda imagen
        await updateStep(VerificationStep.IMAGE_CROP_2);
      } else {
        // Si no es válida, redirigir a la página principal
        router.push('/verify');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al validar imagen');
    }
  };

  const handleSecondCropComplete = async (cropData: CropData) => {
    if (!session?.secondImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/crop2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: session.secondImageUrl,
          cropData
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar segunda imagen recortada');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
      
      // Avanzar al siguiente paso
      await updateStep(VerificationStep.ARROW_PLACEMENT_2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar segunda imagen');
    }
  };

  const handleSecondArrowComplete = async (arrowData: ArrowData) => {
    if (!session?.secondCroppedImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/arrow2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arrowData }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar flecha en segunda imagen');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
      
      // Avanzar al paso de revisión
      await updateStep(VerificationStep.REVIEW);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar flecha en segunda imagen');
    }
  };

  const getStepProgress = () => {
    if (!session) return { current: 0, total: 0, percentage: 0 };
    
    const steps = Object.keys(VERIFICATION_STEPS_CONFIG);
    const currentIndex = steps.indexOf(session.currentStep);
    
    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: Math.round(((currentIndex + 1) / steps.length) * 100)
    };
  };

  const renderStepContent = () => {
    if (!session) return null;

    const stepConfig = VERIFICATION_STEPS_CONFIG[session.currentStep];
    
    switch (session.currentStep) {
      case VerificationStep.DATA_VALIDATION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Validación de Datos DEA</h2>
            <p className="text-gray-600 mb-6">
              Valida y corrige automáticamente los datos del DEA antes de procesar las imágenes.
            </p>
            {session.deaRecord && (
              <DeaValidationPanel
                deaRecordId={session.deaRecord.id}
                onValidationComplete={() => {
                  // Continuar al siguiente paso después de la validación
                  updateStep(VerificationStep.DEA_INFO);
                }}
              />
            )}
          </div>
        );

      case VerificationStep.DEA_INFO:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Información del DEA</h2>
            {session.deaRecord && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Datos Básicos</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">DEA #:</span> {session.deaRecord.numeroProvisionalDea}</p>
                    <p><span className="font-medium">Nombre:</span> {session.deaRecord.nombre}</p>
                    <p><span className="font-medium">Tipo:</span> {session.deaRecord.tipoEstablecimiento}</p>
                    <p><span className="font-medium">Distrito:</span> {session.deaRecord.distrito}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Ubicación</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Dirección:</span> {session.deaRecord.tipoVia} {session.deaRecord.nombreVia} {session.deaRecord.numeroVia}</p>
                    <p><span className="font-medium">CP:</span> {session.deaRecord.codigoPostal}</p>
                    <p><span className="font-medium">Coordenadas:</span> {session.deaRecord.latitud}, {session.deaRecord.longitud}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => updateStep(VerificationStep.IMAGE_CROP_1)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Continuar
              </button>
            </div>
          </div>
        );

      case VerificationStep.IMAGE_CROP_1:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Recortar Imagen</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el área cuadrada de la imagen que quieres conservar. 
              Arrastra para mover la selección y usa las esquinas para redimensionar.
            </p>
            {session.originalImageUrl ? (
              <ImageCropper
                imageUrl={session.originalImageUrl}
                onCropChange={handleCropChange}
                onCropComplete={handleCropComplete}
                onCancel={handleCropCancel}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay imagen disponible para recortar</p>
              </div>
            )}
          </div>
        );

      case VerificationStep.ARROW_PLACEMENT_1:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Colocar Flecha</h2>
            <p className="text-gray-600 mb-6">
              Coloca una flecha en la imagen recortada para señalar el DEA.
            </p>
            {session.croppedImageUrl ? (
              <ArrowPlacer
                imageUrl={session.croppedImageUrl}
                onArrowComplete={handleArrowComplete}
                onCancel={handleArrowCancel}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay imagen recortada disponible</p>
                <button
                  onClick={() => updateStep(VerificationStep.IMAGE_CROP_1)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Volver a Recortar
                </button>
              </div>
            )}
          </div>
        );

      case VerificationStep.IMAGE_VALIDATION_2:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Validar Segunda Imagen</h2>
            {session.secondImageUrl ? (
              <ImageValidator
                imageUrl={session.secondImageUrl}
                descripcionAcceso={session.deaRecord?.descripcionAcceso}
                onValidationComplete={handleImageValidation}
                onCancel={() => updateStep(VerificationStep.ARROW_PLACEMENT_1)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay segunda imagen disponible</p>
                <button
                  onClick={() => updateStep(VerificationStep.ARROW_PLACEMENT_1)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Continuar sin segunda imagen
                </button>
              </div>
            )}
          </div>
        );

      case VerificationStep.IMAGE_CROP_2:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Recortar Segunda Imagen</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el área cuadrada de la segunda imagen que quieres conservar.
            </p>
            {session.secondImageUrl ? (
              <ImageCropper
                imageUrl={session.secondImageUrl}
                onCropChange={handleCropChange}
                onCropComplete={handleSecondCropComplete}
                onCancel={() => updateStep(VerificationStep.IMAGE_VALIDATION_2)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay segunda imagen disponible para recortar</p>
              </div>
            )}
          </div>
        );

      case VerificationStep.ARROW_PLACEMENT_2:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Colocar Flecha en Segunda Imagen</h2>
            <p className="text-gray-600 mb-6">
              Coloca una flecha en la segunda imagen recortada. Puedes seleccionar tanto el punto de inicio como el final de la flecha.
            </p>
            {session.secondCroppedImageUrl ? (
              <ArrowPlacerWithOrigin
                imageUrl={session.secondCroppedImageUrl}
                onArrowComplete={handleSecondArrowComplete}
                onCancel={() => updateStep(VerificationStep.IMAGE_CROP_2)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay segunda imagen recortada disponible</p>
                <button
                  onClick={() => updateStep(VerificationStep.IMAGE_CROP_2)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Volver a Recortar Segunda Imagen
                </button>
              </div>
            )}
          </div>
        );

      case VerificationStep.REVIEW:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Revisar y Confirmar</h2>
            <p className="text-gray-600 mb-6">
              Revisa ambas imágenes procesadas antes de guardar
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Primera imagen */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Primera Imagen</h3>
                {session.processedImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <img
                      src={session.processedImageUrl}
                      alt="Primera imagen procesada"
                      className="w-full max-w-xs md:max-w-sm mx-auto aspect-square object-cover rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      ✅ Imagen recortada y con flecha
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    <p className="text-gray-500">Primera imagen no procesada</p>
                  </div>
                )}
              </div>

              {/* Segunda imagen */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Segunda Imagen</h3>
                {session.secondProcessedImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <img
                      src={session.secondProcessedImageUrl}
                      alt="Segunda imagen procesada"
                      className="w-full max-w-xs md:max-w-sm mx-auto aspect-square object-cover rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      ✅ Imagen recortada y con flecha personalizada
                    </p>
                  </div>
                ) : session.secondImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    <p className="text-gray-500">Segunda imagen no procesada</p>
                    <p className="text-xs text-gray-400 mt-1">
                      La imagen fue validada pero no se completó el procesamiento
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    <p className="text-gray-500">No hay segunda imagen</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Este DEA solo tiene una imagen
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">Resumen de Verificación</h4>
              <div className="text-blue-700 text-sm space-y-1">
                <p>• Primera imagen: {session.processedImageUrl ? 'Procesada correctamente' : 'Pendiente'}</p>
                <p>• Segunda imagen: {
                  session.secondProcessedImageUrl ? 'Procesada correctamente' : 
                  session.secondImageUrl ? 'Validada pero no procesada' : 
                  'No disponible'
                }</p>
                {session.deaRecord && (
                  <p>• DEA #{session.deaRecord.numeroProvisionalDea} - {session.deaRecord.nombre}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => updateStep(session.secondProcessedImageUrl ? VerificationStep.ARROW_PLACEMENT_2 : VerificationStep.ARROW_PLACEMENT_1)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 order-last sm:order-first"
              >
                Anterior
              </button>
              <button
                onClick={completeVerification}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Completar Verificación
              </button>
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

  if (loading) {
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
