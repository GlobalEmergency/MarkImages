"use client";

import { Loader2, Check, X, Upload } from "lucide-react";
import { useState, useEffect } from "react";

import ObservationsDisplay from "@/components/verification/ObservationsDisplay";
import { AedImageType, IMAGE_TYPE_OPTIONS } from "@/types/image";
import type { ImageValidationItem, ImagesValidationResult } from "@/types/verification";
import { compressImageFile } from "@/utils/imageCompression";
import { loadImageWithRetry } from "@/utils/imageLoader";

interface ImageMultiSelectorProps {
  images: Array<{
    id: string;
    original_url: string;
    type?: string;
    order?: number;
  }>;
  descripcionAcceso?: string;
  onValidationComplete: (result: ImagesValidationResult) => void | Promise<void>;
  onCancel: () => void;
}

interface ImageState extends ImageValidationItem {
  loading: boolean;
  error: boolean;
  dataUrl: string;
  selectedType?: AedImageType;
}

export default function ImageMultiSelector({
  images,
  descripcionAcceso,
  onValidationComplete,
  onCancel,
}: ImageMultiSelectorProps) {
  const [imageStates, setImageStates] = useState<ImageState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newImages, setNewImages] = useState<
    Array<{ url: string; order: number; type?: AedImageType }>
  >([]);

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
      selectedType: img.type as AedImageType | undefined,
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

  const handleTypeChange = (index: number, type: AedImageType) => {
    setImageStates((prev) =>
      prev.map((state, idx) => (idx === index ? { ...state, selectedType: type } : state))
    );
  };

  const handleAddNewImage = (url: string) => {
    const maxOrder = Math.max(
      ...imageStates.map((s) => s.order),
      ...newImages.map((n) => n.order),
      0
    );
    setNewImages((prev) => [...prev, { url, order: maxOrder + 1, type: undefined }]);
  };

  const handleNewImageTypeChange = (index: number, type: AedImageType) => {
    setNewImages((prev) => prev.map((img, idx) => (idx === index ? { ...img, type } : img)));
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

    // Validar que todas las imágenes válidas tengan tipo seleccionado
    const imagesWithoutType = validImages.filter((img) => !img.selectedType);
    const newImagesWithoutType = newImages.filter((img) => !img.type);

    if (imagesWithoutType.length > 0 || newImagesWithoutType.length > 0) {
      alert(
        "Todas las imágenes deben tener un tipo asignado. Por favor, selecciona el tipo para cada imagen antes de continuar."
      );
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
          type: img.selectedType,
        })),
        deletedImageIds,
        newImages: newImages.length > 0 ? newImages : undefined,
      };

      // Await the parent callback — it performs the PATCH + updateStep.
      // Keep isProcessing=true until the parent finishes so the user sees
      // the spinner the whole time instead of a stale screen.
      await onValidationComplete(result);
    } catch (error) {
      console.error("Error processing validation:", error);
      // Only reset processing on error — on success the parent will
      // unmount this component by advancing to the next step.
      setIsProcessing(false);
    }
  };

  const validCount = imageStates.filter((img) => img.isValid).length + newImages.length;
  const totalImages = imageStates.length + newImages.length;
  const hasNoValidImages = validCount === 0;
  const validImagesWithoutType = imageStates.filter(
    (img) => img.isValid && !img.selectedType
  ).length;
  const newImagesWithoutType = newImages.filter((img) => !img.type).length;
  const totalImagesWithoutType = validImagesWithoutType + newImagesWithoutType;

  // Vista principal: Grid de imágenes (sin modo separado)
  return (
    <div className="space-y-6 w-full">
      {/* Descripción de acceso */}
      <ObservationsDisplay
        observations={descripcionAcceso}
        title="Descripción de Acceso"
        icon={<Upload className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />}
      />

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
        {/* Imágenes existentes */}
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
            <div className="p-3 bg-gray-50 space-y-2">
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

              {/* Selector de tipo de imagen */}
              {img.isValid && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600 block">
                    Tipo de imagen *
                  </label>
                  <select
                    value={img.selectedType || ""}
                    onChange={(e) => handleTypeChange(index, e.target.value as AedImageType)}
                    disabled={img.loading}
                    className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                      !img.selectedType ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                  >
                    <option value="">Seleccionar tipo...</option>
                    {IMAGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!img.selectedType && <p className="text-xs text-red-600">⚠️ Tipo requerido</p>}
                </div>
              )}
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
            <div className="p-3 bg-gray-50 space-y-2">
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

              {/* Selector de tipo de imagen */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 block">Tipo de imagen *</label>
                <select
                  value={img.type || ""}
                  onChange={(e) => handleNewImageTypeChange(index, e.target.value as AedImageType)}
                  className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    !img.type ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                >
                  <option value="">Seleccionar tipo...</option>
                  {IMAGE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!img.type && <p className="text-xs text-red-600">⚠️ Tipo requerido</p>}
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta para subir nueva imagen - AL FINAL */}
        <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md overflow-hidden border-2 border-dashed border-blue-400 hover:border-blue-600 transition-all hover:shadow-lg cursor-pointer">
          <label className="aspect-square relative bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center cursor-pointer">
            <div className="text-center p-6">
              <Upload className="w-16 h-16 text-blue-600 mx-auto mb-3" />
              <p className="text-blue-800 font-semibold mb-2">Subir Nueva Imagen</p>
              <p className="text-blue-600 text-xs">Haz clic para agregar más imágenes</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    // Comprimir la imagen antes de subirla
                    console.log(
                      `📸 Subiendo imagen: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
                    );

                    const compressedUrl = await compressImageFile(file, {
                      maxWidth: 1920,
                      maxHeight: 1920,
                      quality: 0.85,
                      maxSizeMB: 2,
                    });

                    handleAddNewImage(compressedUrl);
                  } catch (error) {
                    console.error("Error comprimiendo imagen:", error);
                    alert("Error al procesar la imagen. Por favor, intenta con otra imagen.");
                  } finally {
                    // Limpiar el input para permitir subir el mismo archivo otra vez
                    e.target.value = "";
                  }
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Advertencias */}
      {hasNoValidImages && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">
            ⚠️ <strong>Atención:</strong> No hay imágenes válidas. Debes marcar al menos una imagen
            como válida o subir nuevas imágenes para continuar.
          </p>
        </div>
      )}

      {totalImagesWithoutType > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ <strong>Tipo de imagen requerido:</strong> {totalImagesWithoutType} imagen(es)
            necesitan que selecciones su tipo antes de continuar.
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3">
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
