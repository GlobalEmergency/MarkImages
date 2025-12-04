"use client";

import { Loader2, Check, X, Upload } from "lucide-react";
import { useState, useEffect } from "react";

import ImageUpload from "@/components/ImageUpload";
import type { ImageValidationItem, ImagesValidationResult } from "@/types/verification";
import { loadImageWithRetry } from "@/utils/imageLoader";

interface ImageMultiSelectorProps {
  images: Array<{
    id: string;
    original_url: string;
    type?: string;
    order?: number;
  }>;
  descripcionAcceso?: string;
  onValidationComplete: (result: ImagesValidationResult) => void;
  onCancel: () => void;
}

interface ImageState extends ImageValidationItem {
  loading: boolean;
  error: boolean;
  dataUrl: string;
}

export default function ImageMultiSelector({
  images,
  descripcionAcceso,
  onValidationComplete,
  onCancel,
}: ImageMultiSelectorProps) {
  const [imageStates, setImageStates] = useState<ImageState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [newImages, setNewImages] = useState<Array<{ url: string; order: number }>>([]);

  // Inicializar estados de las imágenes
  useEffect(() => {
    const initialStates: ImageState[] = images.map((img, index) => ({
      id: img.id,
      url: img.original_url,
      order: img.order ?? index,
      type: img.type,
      isValid: true, // Por defecto todas son válidas
      loading: true,
      error: false,
      dataUrl: "",
    }));

    setImageStates(initialStates);
    loadAllImages(initialStates);
  }, [images]);

  const loadAllImages = async (states: ImageState[]) => {
    for (let i = 0; i < states.length; i++) {
      try {
        const result = await loadImageWithRetry(states[i].url, {
          maxRetries: 3,
          initialDelay: 1000,
          useCacheBusting: true,
          useProxyFallback: true,
        });

        const canvas = document.createElement("canvas");
        canvas.width = result.image.width;
        canvas.height = result.image.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(result.image, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

          setImageStates((prev) =>
            prev.map((state, idx) => (idx === i ? { ...state, loading: false, dataUrl } : state))
          );
        }
      } catch (error) {
        console.error(`Error loading image ${i}:`, error);
        setImageStates((prev) =>
          prev.map((state, idx) =>
            idx === i ? { ...state, loading: false, error: true, dataUrl: states[i].url } : state
          )
        );
      }
    }
  };

  const handleToggleValid = (index: number) => {
    setImageStates((prev) =>
      prev.map((state, idx) => (idx === index ? { ...state, isValid: !state.isValid } : state))
    );
  };

  const handleAddNewImage = (url: string) => {
    const maxOrder = Math.max(
      ...imageStates.map((s) => s.order),
      ...newImages.map((n) => n.order),
      0
    );
    setNewImages((prev) => [...prev, { url, order: maxOrder + 1 }]);
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleContinue = async () => {
    const validImages = imageStates.filter((img) => img.isValid);
    const deletedImageIds = imageStates.filter((img) => !img.isValid).map((img) => img.id);

    if (validImages.length === 0 && newImages.length === 0) {
      alert("Debes tener al menos una imagen válida o subir una nueva imagen para continuar.");
      return;
    }

    setIsProcessing(true);

    try {
      const result: ImagesValidationResult = {
        validImages: validImages.map((img) => ({
          id: img.id,
          url: img.url,
          order: img.order,
          isValid: img.isValid,
          type: img.type,
        })),
        deletedImageIds,
        newImages: newImages.length > 0 ? newImages : undefined,
      };

      await new Promise((resolve) => setTimeout(resolve, 500));
      onValidationComplete(result);
    } catch (error) {
      console.error("Error processing validation:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = imageStates.filter((img) => img.isValid).length + newImages.length;
  const totalImages = imageStates.length + newImages.length;
  const hasNoValidImages = validCount === 0;

  // Caso: Sin imágenes
  if (images.length === 0 && !uploadMode) {
    return (
      <div className="space-y-6 w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Sin Imágenes</div>
          <p className="text-red-700 mb-4">Este DEA no tiene imágenes disponibles para procesar.</p>
          <button
            onClick={() => setUploadMode(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📤 Subir Nuevas Imágenes
          </button>
        </div>
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Volver
        </button>
      </div>
    );
  }

  // Modo de subida de imágenes
  if (uploadMode) {
    return (
      <div className="space-y-6 w-full">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Subir Nuevas Imágenes</h3>
          <p className="text-blue-700 mb-6">
            Agrega una o más imágenes para este DEA. Cada imagen debe ser clara y mostrar la
            ubicación del DEA.
          </p>

          {newImages.map((img, index) => (
            <div key={index} className="mb-4 p-4 bg-white rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Imagen {index + 1}</span>
                <button
                  onClick={() => handleRemoveNewImage(index)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Eliminar
                </button>
              </div>
              <img
                src={img.url}
                alt={`Nueva imagen ${index + 1}`}
                className="w-full h-48 object-cover rounded"
              />
            </div>
          ))}

          <div className="mt-4">
            <ImageUpload
              label="Agregar Imagen"
              value={undefined}
              onChange={(url) => url && handleAddNewImage(url)}
              prefix="dea-images"
              required={false}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setUploadMode(false)}
            disabled={isProcessing}
            className="px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {newImages.length > 0 ? "Finalizar Subida" : "Cancelar"}
          </button>
        </div>
      </div>
    );
  }

  // Vista principal: Grid de imágenes
  return (
    <div className="space-y-6 w-full">
      {/* Descripción de acceso */}
      {descripcionAcceso && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-blue-800 mb-2">Descripción de Acceso</h4>
          <p className="text-blue-700">{descripcionAcceso}</p>
        </div>
      )}

      {/* Información de validación */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-yellow-800 mb-2">
          Validar Imágenes ({validCount} de {totalImages} válidas)
        </h4>
        <p className="text-yellow-700 text-sm mb-3">
          Revisa cada imagen y marca las que son válidas. Puedes eliminar las que no sirvan y subir
          nuevas.
        </p>
        <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
          <li>
            ✅ <strong>Válida:</strong> La imagen es clara y muestra bien el DEA
          </li>
          <li>
            ❌ <strong>Eliminar:</strong> La imagen es borrosa, incorrecta o no sirve
          </li>
          <li>
            📤 <strong>Subir nuevas:</strong> Agrega imágenes adicionales si es necesario
          </li>
        </ul>
      </div>

      {/* Grid de imágenes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {imageStates.map((img, index) => (
          <div
            key={img.id}
            className={`relative bg-white rounded-lg shadow-md overflow-hidden border-2 transition-all ${
              img.isValid ? "border-green-500" : "border-red-500 opacity-60"
            }`}
          >
            {/* Imagen */}
            <div className="aspect-square relative bg-gray-100">
              {img.loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : img.error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                  <p className="text-red-600 text-sm">Error al cargar</p>
                </div>
              ) : (
                <img
                  src={img.dataUrl || img.url}
                  alt={`Imagen ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Badge de estado */}
              <div
                className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold ${
                  img.isValid ? "bg-green-500 text-white" : "bg-red-500 text-white"
                }`}
              >
                {img.isValid ? "✓ Válida" : "✗ Eliminada"}
              </div>
            </div>

            {/* Controles */}
            <div className="p-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Imagen {index + 1}</span>
                <button
                  onClick={() => handleToggleValid(index)}
                  disabled={img.loading}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    img.isValid
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {img.isValid ? (
                    <>
                      <X className="w-4 h-4 inline mr-1" />
                      Eliminar
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 inline mr-1" />
                      Recuperar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Nuevas imágenes subidas */}
        {newImages.map((img, index) => (
          <div
            key={`new-${index}`}
            className="relative bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-500"
          >
            <div className="aspect-square relative bg-gray-100">
              <img
                src={img.url}
                alt={`Nueva imagen ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                ✓ Nueva
              </div>
            </div>
            <div className="p-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Nueva {index + 1}</span>
                <button
                  onClick={() => handleRemoveNewImage(index)}
                  className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advertencia si no hay imágenes válidas */}
      {hasNoValidImages && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">
            ⚠️ <strong>Atención:</strong> No hay imágenes válidas. Debes marcar al menos una imagen
            como válida o subir nuevas imágenes para continuar.
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setUploadMode(true)}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
        >
          <Upload className="w-5 h-5 mr-2" />
          Subir Más Imágenes
        </button>
        <button
          onClick={handleContinue}
          disabled={isProcessing || hasNoValidImages}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Continuar
            </>
          )}
        </button>
      </div>

      <button
        onClick={onCancel}
        className="w-full px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        disabled={isProcessing}
      >
        Volver
      </button>
    </div>
  );
}
