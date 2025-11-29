'use client';

import { useState, useEffect } from 'react';
import { Loader2, Upload, Trash2, Check, X, ArrowLeftRight } from 'lucide-react';
import { loadImageWithRetry } from '@/utils/imageLoader';
import ImageUpload from '@/components/ImageUpload';

interface ImagePairSelectorProps {
  image1Url?: string;
  image2Url?: string;
  descripcionAcceso?: string;
  onSelectionComplete: (selection: ImageSelection) => void;
  onUploadNewImages?: (image1Url: string | null, image2Url: string | null) => void;
  onCancel: () => void;
}

export interface ImageSelection {
  image1Valid: boolean;
  image2Valid: boolean;
  imagesSwapped: boolean;
  markedAsInvalid: boolean;
}

type SelectionOption =
  | 'both_valid'
  | 'only_image1'
  | 'only_image2'
  | 'both_invalid'
  | 'swap_images'
  | 'single_as_image1'
  | 'single_as_image2'
  | 'single_invalid';

type ImageStatus = 'valid' | 'invalid' | 'pending';
type ImageAction = 'keep' | 'replace' | 'delete';

export default function ImagePairSelector({
  image1Url,
  image2Url,
  descripcionAcceso,
  onSelectionComplete,
  onUploadNewImages,
  onCancel
}: ImagePairSelectorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [image1Loaded, setImage1Loaded] = useState(false);
  const [image2Loaded, setImage2Loaded] = useState(false);
  const [image1Error, setImage1Error] = useState(false);
  const [image2Error, setImage2Error] = useState(false);
  const [image1DataUrl, setImage1DataUrl] = useState<string>('');
  const [image2DataUrl, setImage2DataUrl] = useState<string>('');
  const [loadingState, setLoadingState] = useState<string>('Cargando imágenes...');
  const [uploadMode, setUploadMode] = useState(false);
  const [newImage1Url, setNewImage1Url] = useState<string | null>(null);
  const [newImage2Url, setNewImage2Url] = useState<string | null>(null);

  // New state for individual image control
  const [image1Status, setImage1Status] = useState<ImageStatus>('pending');
  const [image2Status, setImage2Status] = useState<ImageStatus>('pending');
  const [image1Action, setImage1Action] = useState<ImageAction>('keep');
  const [image2Action, setImage2Action] = useState<ImageAction>('keep');
  const [uploadingImage1, setUploadingImage1] = useState(false);
  const [uploadingImage2, setUploadingImage2] = useState(false);
  const [imagesSwapped, setImagesSwapped] = useState(false);

  const hasImage1 = !!image1Url;
  const hasImage2 = !!image2Url;
  const hasSingleImage = (hasImage1 && !hasImage2) || (!hasImage1 && hasImage2);
  const hasNoImages = !hasImage1 && !hasImage2;

  // Cargar imágenes
  useEffect(() => {
    const loadImages = async () => {
      // Cargar imagen 1
      if (image1Url) {
        try {
          setLoadingState('Cargando imagen 1...');
          const result = await loadImageWithRetry(image1Url, {
            maxRetries: 3,
            initialDelay: 1000,
            useCacheBusting: true,
            useProxyFallback: true,
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = result.image.width;
          canvas.height = result.image.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(result.image, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setImage1DataUrl(dataUrl);
            setImage1Loaded(true);
          }
        } catch (error) {
          console.error('Error loading image 1:', error);
          setImage1Error(true);
          setImage1DataUrl(image1Url);
        }
      }

      // Cargar imagen 2
      if (image2Url) {
        try {
          setLoadingState('Cargando imagen 2...');
          const result = await loadImageWithRetry(image2Url, {
            maxRetries: 3,
            initialDelay: 1000,
            useCacheBusting: true,
            useProxyFallback: true,
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = result.image.width;
          canvas.height = result.image.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(result.image, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setImage2DataUrl(dataUrl);
            setImage2Loaded(true);
          }
        } catch (error) {
          console.error('Error loading image 2:', error);
          setImage2Error(true);
          setImage2DataUrl(image2Url);
        }
      }

      setLoadingState('');
    };

    loadImages();
  }, [image1Url, image2Url]);

  const handleSelection = async (option: SelectionOption) => {
    setIsProcessing(true);
    
    try {
      let selection: ImageSelection;

      switch (option) {
        case 'both_valid':
          selection = {
            image1Valid: true,
            image2Valid: true,
            imagesSwapped: false,
            markedAsInvalid: false
          };
          break;
        case 'only_image1':
          selection = {
            image1Valid: true,
            image2Valid: false,
            imagesSwapped: false,
            markedAsInvalid: false
          };
          break;
        case 'only_image2':
          selection = {
            image1Valid: false,
            image2Valid: true,
            imagesSwapped: false,
            markedAsInvalid: false
          };
          break;
        case 'both_invalid':
          selection = {
            image1Valid: false,
            image2Valid: false,
            imagesSwapped: false,
            markedAsInvalid: true
          };
          break;
        case 'swap_images':
          selection = {
            image1Valid: true,
            image2Valid: true,
            imagesSwapped: true,
            markedAsInvalid: false
          };
          break;
        case 'single_as_image1':
          selection = {
            image1Valid: true,
            image2Valid: false,
            imagesSwapped: false,
            markedAsInvalid: false
          };
          break;
        case 'single_as_image2':
          selection = {
            image1Valid: false,
            image2Valid: true,
            imagesSwapped: hasImage1, // Si la única imagen es image1, necesitamos swap
            markedAsInvalid: false
          };
          break;
        case 'single_invalid':
          selection = {
            image1Valid: false,
            image2Valid: false,
            imagesSwapped: false,
            markedAsInvalid: true
          };
          break;
        default:
          throw new Error('Opción no válida');
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      onSelectionComplete(selection);
    } catch (error) {
      console.error('Error processing selection:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadNewImages = async () => {
    if (!onUploadNewImages) return;
    if (!newImage1Url && !newImage2Url) return;

    setIsProcessing(true);
    try {
      await onUploadNewImages(newImage1Url, newImage2Url);
    } catch (error) {
      console.error('Error uploading new images:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Renderizar caso: Sin imágenes
  if (hasNoImages) {
    if (uploadMode && onUploadNewImages) {
      return (
        <div className="space-y-6 w-full">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">Subir Nuevas Imágenes</h3>
            <p className="text-blue-700 mb-6">
              Sube 1 o 2 imágenes nuevas para este DEA. Las imágenes deben corresponder a:
            </p>
            <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside mb-6">
              <li><strong>Imagen 1 (Entrada):</strong> Vista general desde la entrada</li>
              <li><strong>Imagen 2 (Detalle):</strong> Vista de cerca del DEA</li>
            </ul>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUpload
                label="Imagen 1 (Entrada) - Opcional"
                value={newImage1Url || undefined}
                onChange={(url) => setNewImage1Url(url)}
                prefix="dea-images/entrada"
                required={false}
              />
              <ImageUpload
                label="Imagen 2 (Detalle) - Opcional"
                value={newImage2Url || undefined}
                onChange={(url) => setNewImage2Url(url)}
                prefix="dea-images/detalle"
                required={false}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleUploadNewImages}
              disabled={isProcessing || (!newImage1Url && !newImage2Url)}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Procesando...
                </>
              ) : (
                'Continuar con las Imágenes Subidas'
              )}
            </button>
            <button
              onClick={() => {
                setUploadMode(false);
                setNewImage1Url(null);
                setNewImage2Url(null);
              }}
              disabled={isProcessing}
              className="px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>

          {!newImage1Url && !newImage2Url && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-700 text-sm">
                ⚠️ Debes subir al menos una imagen para continuar
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6 w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Sin Imágenes</div>
          <p className="text-red-700 mb-4">
            Este DEA no tiene imágenes disponibles para procesar.
          </p>
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            {onUploadNewImages && (
              <button
                onClick={() => setUploadMode(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📤 Subir Nuevas Imágenes
              </button>
            )}
            <button
              onClick={() => handleSelection('both_invalid')}
              disabled={isProcessing}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isProcessing ? 'Procesando...' : 'Marcar DEA como Inválido'}
            </button>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isProcessing}
        >
          Volver
        </button>
      </div>
    );
  }

  const isLoading = (hasImage1 && !image1Loaded && !image1Error) || 
                     (hasImage2 && !image2Loaded && !image2Error);

  // Renderizar caso: Una sola imagen
  if (hasSingleImage) {
    const singleImageUrl = image1DataUrl || image2DataUrl || image1Url || image2Url;
    const imageLoaded = image1Loaded || image2Loaded;
    const imageError = image1Error || image2Error;

    return (
      <div className="space-y-6 w-full">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Imagen Disponible</h3>
          <div className="flex justify-center">
            {isLoading ? (
              <div className="w-full max-w-md aspect-square flex items-center justify-center bg-white rounded-lg shadow-md border border-gray-200">
                <div className="text-center p-8">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">{loadingState}</p>
                </div>
              </div>
            ) : imageError ? (
              <div className="w-full max-w-md aspect-square flex items-center justify-center bg-red-50 rounded-lg shadow-md border border-red-200">
                <div className="text-center p-8">
                  <p className="text-red-600 font-medium mb-2">⚠️ Error al cargar</p>
                  <p className="text-sm text-red-500">No se pudo cargar la imagen</p>
                </div>
              </div>
            ) : (
              <img
                src={singleImageUrl}
                alt="Imagen del DEA"
                className="w-full max-w-md rounded-lg shadow-md aspect-square object-cover"
              />
            )}
          </div>
        </div>

        {descripcionAcceso && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-md font-semibold text-blue-800 mb-2">Descripción de Acceso</h4>
            <p className="text-blue-700">{descripcionAcceso}</p>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-yellow-800 mb-3">
            Clasificar Imagen
          </h4>
          <p className="text-yellow-700 text-sm mb-4">
            Por favor, indica si esta imagen corresponde a la foto de entrada o a la foto de detalle del DEA.
          </p>
          <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
            <li><strong>Foto 1 (Entrada):</strong> Vista general, desde la entrada o acceso al lugar</li>
            <li><strong>Foto 2 (Detalle):</strong> Vista de cerca del DEA o su ubicación exacta</li>
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleSelection('single_as_image1')}
              disabled={isProcessing || !imageLoaded}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Es Foto 1 (Entrada)
            </button>
            <button
              onClick={() => handleSelection('single_as_image2')}
              disabled={isProcessing || !imageLoaded}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Es Foto 2 (Detalle)
            </button>
          </div>
          <button
            onClick={() => handleSelection('single_invalid')}
            disabled={isProcessing || !imageLoaded}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Imagen Inválida
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={isProcessing}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Modo de subida de imágenes cuando hay imágenes inválidas
  if (uploadMode && onUploadNewImages) {
    return (
      <div className="space-y-6 w-full">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Subir Nuevas Imágenes</h3>
          <p className="text-blue-700 mb-6">
            Las imágenes actuales no son válidas. Sube 1 o 2 imágenes nuevas para reemplazarlas:
          </p>
          <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside mb-6">
            <li><strong>Imagen 1 (Entrada):</strong> Vista general desde la entrada</li>
            <li><strong>Imagen 2 (Detalle):</strong> Vista de cerca del DEA</li>
          </ul>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUpload
              label="Imagen 1 (Entrada) - Opcional"
              value={newImage1Url || undefined}
              onChange={(url) => setNewImage1Url(url)}
              prefix="dea-images/entrada"
              required={false}
            />
            <ImageUpload
              label="Imagen 2 (Detalle) - Opcional"
              value={newImage2Url || undefined}
              onChange={(url) => setNewImage2Url(url)}
              prefix="dea-images/detalle"
              required={false}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleUploadNewImages}
            disabled={isProcessing || (!newImage1Url && !newImage2Url)}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Procesando...
              </>
            ) : (
              'Continuar con las Imágenes Subidas'
            )}
          </button>
          <button
            onClick={() => {
              setUploadMode(false);
              setNewImage1Url(null);
              setNewImage2Url(null);
            }}
            disabled={isProcessing}
            className="px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>

        {!newImage1Url && !newImage2Url && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              ⚠️ Debes subir al menos una imagen para continuar
            </p>
          </div>
        )}
      </div>
    );
  }

  // Function to swap images
  const handleSwapImages = () => {
    // Swap all states between image1 and image2
    const tempStatus = image1Status;
    const tempAction = image1Action;
    const tempUploading = uploadingImage1;
    const tempNewUrl = newImage1Url;

    setImage1Status(image2Status);
    setImage1Action(image2Action);
    setUploadingImage1(uploadingImage2);
    setNewImage1Url(newImage2Url);

    setImage2Status(tempStatus);
    setImage2Action(tempAction);
    setUploadingImage2(tempUploading);
    setNewImage2Url(tempNewUrl);

    // Toggle the swapped flag
    setImagesSwapped(!imagesSwapped);
  };

  // Helper function to handle final submission
  const handleContinue = async () => {
    setIsProcessing(true);

    try {
      // Handle image replacement/deletion first if needed
      if (image1Action === 'replace' || image2Action === 'replace') {
        if (onUploadNewImages) {
          const img1 = image1Action === 'replace' ? newImage1Url : null;
          const img2 = image2Action === 'replace' ? newImage2Url : null;

          if (img1 || img2) {
            await onUploadNewImages(img1, img2);
            return;
          }
        }
      }

      // Determine final selection based on individual image states and actions
      const img1Valid = image1Action !== 'delete' && image1Status === 'valid';
      const img2Valid = image2Action !== 'delete' && image2Status === 'valid';

      const selection: ImageSelection = {
        image1Valid: img1Valid,
        image2Valid: img2Valid,
        imagesSwapped: imagesSwapped,
        markedAsInvalid: !img1Valid && !img2Valid
      };

      await new Promise(resolve => setTimeout(resolve, 500));
      onSelectionComplete(selection);
    } catch (error) {
      console.error('Error processing selection:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine if continue button should be enabled
  const canContinue = () => {
    // At least one image must be marked as valid and kept
    const hasValidImage =
      (image1Status === 'valid' && image1Action === 'keep') ||
      (image2Status === 'valid' && image2Action === 'keep') ||
      (image1Action === 'replace' && newImage1Url) ||
      (image2Action === 'replace' && newImage2Url);

    return hasValidImage && !isProcessing;
  };

  // Renderizar caso: Dos imágenes
  return (
    <div className="space-y-6 w-full">
      {descripcionAcceso && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-blue-800 mb-2">Descripción de Acceso</h4>
          <p className="text-blue-700">{descripcionAcceso}</p>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-yellow-800 mb-3">
          Validar Imágenes
        </h4>
        <p className="text-yellow-700 text-sm">
          Para cada imagen, indica si es válida, si deseas subir una nueva, o si quieres eliminarla.
          Al menos una imagen debe ser válida para continuar.
        </p>
      </div>

      {/* Swap Images Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSwapImages}
          disabled={isProcessing || (!image1Loaded && !image2Loaded)}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors"
        >
          <ArrowLeftRight className="w-5 h-5" />
          Intercambiar Imágenes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Imagen 1 */}
        <div className={`bg-white rounded-lg border-2 ${
          image1Status === 'valid' ? 'border-green-500' :
          image1Status === 'invalid' ? 'border-red-500' :
          'border-gray-200'
        } p-4 transition-all`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Imagen 1 (Entrada)</h3>
            {image1Status === 'valid' && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> Válida
              </span>
            )}
            {image1Status === 'invalid' && (
              <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                <X className="w-4 h-4" /> Inválida
              </span>
            )}
          </div>

          {/* Image Display */}
          {uploadingImage1 ? (
            <div className="mb-4">
              <ImageUpload
                label="Nueva Imagen 1"
                value={newImage1Url || undefined}
                onChange={(url) => setNewImage1Url(url)}
                prefix="dea-images/entrada"
                required={false}
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              {!image1Loaded && !image1Error ? (
                <div className="w-full aspect-square flex items-center justify-center bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="text-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Cargando...</p>
                  </div>
                </div>
              ) : image1Error ? (
                <div className="w-full aspect-square flex items-center justify-center bg-red-50 rounded-lg shadow-md border border-red-200">
                  <div className="text-center p-8">
                    <p className="text-red-600 text-sm">Error al cargar</p>
                  </div>
                </div>
              ) : (
                <img
                  src={image1DataUrl || image1Url}
                  alt="Imagen 1 - Entrada"
                  className="w-full rounded-lg shadow-md aspect-square object-cover"
                />
              )}
            </div>
          )}

          {/* Image Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImage1Status('valid');
                  setImage1Action('keep');
                  setUploadingImage1(false);
                }}
                disabled={isProcessing || (!image1Loaded && !image1Error)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  image1Status === 'valid' && image1Action === 'keep'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Check className="w-4 h-4 inline mr-1" />
                Válida
              </button>
              <button
                onClick={() => {
                  setImage1Status('invalid');
                  setImage1Action('keep');
                  setUploadingImage1(false);
                }}
                disabled={isProcessing || (!image1Loaded && !image1Error)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  image1Status === 'invalid' && image1Action === 'keep'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <X className="w-4 h-4 inline mr-1" />
                Inválida
              </button>
            </div>

            {onUploadNewImages && (
              <button
                onClick={() => {
                  setUploadingImage1(!uploadingImage1);
                  if (!uploadingImage1) {
                    setImage1Action('replace');
                  } else {
                    setImage1Action('keep');
                    setNewImage1Url(null);
                  }
                }}
                disabled={isProcessing}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  uploadingImage1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Upload className="w-4 h-4 inline mr-1" />
                {uploadingImage1 ? 'Cancelar Subida' : 'Subir Nueva'}
              </button>
            )}

            <button
              onClick={() => {
                setImage1Action('delete');
                setImage1Status('invalid');
                setUploadingImage1(false);
              }}
              disabled={isProcessing}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                image1Action === 'delete'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              {image1Action === 'delete' ? 'Eliminada' : 'Eliminar'}
            </button>
          </div>
        </div>

        {/* Imagen 2 */}
        <div className={`bg-white rounded-lg border-2 ${
          image2Status === 'valid' ? 'border-green-500' :
          image2Status === 'invalid' ? 'border-red-500' :
          'border-gray-200'
        } p-4 transition-all`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Imagen 2 (Detalle)</h3>
            {image2Status === 'valid' && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> Válida
              </span>
            )}
            {image2Status === 'invalid' && (
              <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                <X className="w-4 h-4" /> Inválida
              </span>
            )}
          </div>

          {/* Image Display */}
          {uploadingImage2 ? (
            <div className="mb-4">
              <ImageUpload
                label="Nueva Imagen 2"
                value={newImage2Url || undefined}
                onChange={(url) => setNewImage2Url(url)}
                prefix="dea-images/detalle"
                required={false}
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              {!image2Loaded && !image2Error ? (
                <div className="w-full aspect-square flex items-center justify-center bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="text-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Cargando...</p>
                  </div>
                </div>
              ) : image2Error ? (
                <div className="w-full aspect-square flex items-center justify-center bg-red-50 rounded-lg shadow-md border border-red-200">
                  <div className="text-center p-8">
                    <p className="text-red-600 text-sm">Error al cargar</p>
                  </div>
                </div>
              ) : (
                <img
                  src={image2DataUrl || image2Url}
                  alt="Imagen 2 - Detalle"
                  className="w-full rounded-lg shadow-md aspect-square object-cover"
                />
              )}
            </div>
          )}

          {/* Image Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImage2Status('valid');
                  setImage2Action('keep');
                  setUploadingImage2(false);
                }}
                disabled={isProcessing || (!image2Loaded && !image2Error)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  image2Status === 'valid' && image2Action === 'keep'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Check className="w-4 h-4 inline mr-1" />
                Válida
              </button>
              <button
                onClick={() => {
                  setImage2Status('invalid');
                  setImage2Action('keep');
                  setUploadingImage2(false);
                }}
                disabled={isProcessing || (!image2Loaded && !image2Error)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  image2Status === 'invalid' && image2Action === 'keep'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <X className="w-4 h-4 inline mr-1" />
                Inválida
              </button>
            </div>

            {onUploadNewImages && (
              <button
                onClick={() => {
                  setUploadingImage2(!uploadingImage2);
                  if (!uploadingImage2) {
                    setImage2Action('replace');
                  } else {
                    setImage2Action('keep');
                    setNewImage2Url(null);
                  }
                }}
                disabled={isProcessing}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  uploadingImage2
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Upload className="w-4 h-4 inline mr-1" />
                {uploadingImage2 ? 'Cancelar Subida' : 'Subir Nueva'}
              </button>
            )}

            <button
              onClick={() => {
                setImage2Action('delete');
                setImage2Status('invalid');
                setUploadingImage2(false);
              }}
              disabled={isProcessing}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                image2Action === 'delete'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              {image2Action === 'delete' ? 'Eliminada' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue()}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Procesando...
            </>
          ) : (
            'Continuar'
          )}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isProcessing}
        >
          Cancelar
        </button>
      </div>

      {!canContinue() && !isProcessing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">
            ⚠️ Debes marcar al menos una imagen como válida para continuar
          </p>
        </div>
      )}
    </div>
  );
}
