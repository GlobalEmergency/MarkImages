"use client";

import * as faceapi from "@vladmandic/face-api";
import { Loader2, Plus, Trash2, RotateCcw, Scan } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import type { BlurArea } from "@/types/shared";

interface ImageBlurProps {
  imageUrl: string;
  onBlurComplete: (blurAreas: BlurArea[], blurredImageUrl?: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

interface DrawingArea {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function ImageBlur({ imageUrl, onBlurComplete, onSkip, onCancel }: ImageBlurProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [blurAreas, setBlurAreas] = useState<BlurArea[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingArea, setDrawingArea] = useState<DrawingArea | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [loadingState, setLoadingState] = useState<string>("Cargando imagen...");
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [blurIntensity] = useState<number>(10); // Intensidad del blur
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<string>("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Cargar imagen
  useEffect(() => {
    setImageLoaded(false);
    setLoadingState("Cargando imagen...");
    setRetryAttempt(0);

    const loadImageAsync = async () => {
      try {
        const { loadImageWithRetry } = await import("@/utils/imageLoader");
        const result = await loadImageWithRetry(imageUrl, {
          maxRetries: 3,
          initialDelay: 1000,
          useCacheBusting: true,
          useProxyFallback: true,
          onRetry: (attempt, maxRetries) => {
            setRetryAttempt(attempt);
            if (attempt === maxRetries) {
              setLoadingState(`Último intento... (${attempt}/${maxRetries})`);
            } else {
              setLoadingState(`Reintentando... (${attempt}/${maxRetries})`);
            }
          },
        });

        const img = result.image;

        // Aplicar orientación EXIF
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("No se pudo crear el contexto del canvas");
        }

        const finalWidth = img.width;
        const finalHeight = img.height;

        console.log("=== CARGA DE IMAGEN PARA BLUR ===");
        console.log("Dimensiones:", { width: finalWidth, height: finalHeight });

        canvas.width = finalWidth;
        canvas.height = finalHeight;
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

        const correctedImg = new Image();
        correctedImg.onload = () => {
          setImageDimensions({ width: finalWidth, height: finalHeight });
          setImageLoaded(true);

          const maxWidth = Math.min(window.innerWidth - 64, 800);
          const maxHeight = Math.min(window.innerHeight * 0.6, 600);
          const scale = Math.min(maxWidth / finalWidth, maxHeight / finalHeight, 1);
          setCanvasScale(scale);

          imageRef.current = correctedImg;
          console.log("✅ Imagen cargada para blur");
        };

        correctedImg.src = canvas.toDataURL("image/jpeg", 0.95);
      } catch (error) {
        console.error("❌ Error loading image:", error);
        setLoadingState("Error al cargar la imagen");

        // Fallback
        const { loadImageWithProxy } = await import("@/utils/imageLoader");
        const img = await loadImageWithProxy(imageUrl);

        setImageDimensions({ width: img.width, height: img.height });
        setImageLoaded(true);

        const maxWidth = Math.min(window.innerWidth - 64, 800);
        const maxHeight = Math.min(window.innerHeight * 0.6, 600);
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        setCanvasScale(scale);

        imageRef.current = img;
      }
    };

    loadImageAsync();
  }, [imageUrl]);

  // Cargar modelos de face-api una sola vez
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("🔄 Cargando modelos de detección facial...");

        // Intentar cargar desde local primero, luego desde CDN
        const MODEL_URLS = [
          "/models", // Local: public/models
          "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model", // CDN fallback
        ];

        let modelsLoaded = false;
        let lastError: Error | null = null;

        for (const MODEL_URL of MODEL_URLS) {
          try {
            console.log(`Intentando cargar modelos desde: ${MODEL_URL}`);

            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            ]);

            modelsLoaded = true;
            console.log(`✅ Modelos cargados exitosamente desde: ${MODEL_URL}`);
            break;
          } catch (err) {
            console.warn(`⚠️ No se pudieron cargar modelos desde ${MODEL_URL}:`, err);
            lastError = err as Error;
          }
        }

        if (modelsLoaded) {
          setModelsLoaded(true);
        } else {
          console.error("❌ No se pudieron cargar los modelos de ninguna fuente:", lastError);
          setModelsLoaded(false);
        }
      } catch (error) {
        console.error("❌ Error general cargando modelos de face-api:", error);
        setModelsLoaded(false);
      }
    };

    loadModels();
  }, []);

  // Detectar caras automáticamente
  const detectFaces = async () => {
    if (!imageRef.current || !imageLoaded) {
      console.error("❌ Imagen no cargada");
      return;
    }

    if (!modelsLoaded) {
      setFaceDetectionStatus("Error: Modelos de detección no disponibles");
      return;
    }

    setIsDetectingFaces(true);
    setFaceDetectionStatus("Detectando caras...");

    try {
      console.log("🔍 Iniciando detección de caras...");

      // Detectar caras con TinyFaceDetector (más rápido)
      const detections = await faceapi
        .detectAllFaces(
          imageRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks();

      console.log(`✅ Detectadas ${detections.length} cara(s)`);

      if (detections.length === 0) {
        setFaceDetectionStatus("No se detectaron caras en la imagen");
        setTimeout(() => setFaceDetectionStatus(""), 3000);
        return;
      }

      // Crear áreas de blur para cada cara detectada
      const newBlurAreas: BlurArea[] = detections.map((detection, index) => {
        const box = detection.detection.box;

        // Expandir un poco el área para cubrir mejor la cara
        const padding = Math.max(box.width, box.height) * 0.3;

        return {
          id: `face_${Date.now()}_${index}`,
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: Math.min(box.width + padding * 2, imageDimensions.width - box.x),
          height: Math.min(box.height + padding * 2, imageDimensions.height - box.y),
          intensity: blurIntensity,
        };
      });

      // Añadir las nuevas áreas a las existentes
      setBlurAreas([...blurAreas, ...newBlurAreas]);
      setFaceDetectionStatus(`✅ ${detections.length} cara(s) detectada(s) y marcadas`);
      setTimeout(() => setFaceDetectionStatus(""), 3000);
    } catch (error) {
      console.error("❌ Error en detección de caras:", error);
      setFaceDetectionStatus("Error al detectar caras. Puedes marcar manualmente.");
      setTimeout(() => setFaceDetectionStatus(""), 3000);
    } finally {
      setIsDetectingFaces(false);
    }
  };

  // Dibujar canvas con blur
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (
      !canvas ||
      !img ||
      !imageLoaded ||
      imageDimensions.width === 0 ||
      imageDimensions.height === 0
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calcular escala para ajustar la imagen al canvas
    const maxWidth = Math.min(window.innerWidth - 64, 800);
    const maxHeight = Math.min(window.innerHeight * 0.6, 600);
    const scale = Math.min(maxWidth / imageDimensions.width, maxHeight / imageDimensions.height, 1);

    const displayWidth = imageDimensions.width * scale;
    const displayHeight = imageDimensions.height * scale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar imagen original
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    // Aplicar blur a las áreas guardadas
    blurAreas.forEach((area) => {
      const scaledArea = {
        x: area.x * scale,
        y: area.y * scale,
        width: area.width * scale,
        height: area.height * scale,
      };

      // Guardar contexto
      ctx.save();

      // Aplicar blur (simulación simple con pixelación)
      ctx.filter = `blur(${blurIntensity}px)`;
      ctx.drawImage(
        canvas,
        scaledArea.x,
        scaledArea.y,
        scaledArea.width,
        scaledArea.height,
        scaledArea.x,
        scaledArea.y,
        scaledArea.width,
        scaledArea.height
      );

      // Restaurar contexto
      ctx.restore();

      // Dibujar borde del área difuminada
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(scaledArea.x, scaledArea.y, scaledArea.width, scaledArea.height);
      ctx.setLineDash([]);
    });

    // Dibujar área de dibujo actual
    if (isDrawing && drawingArea) {
      const x = Math.min(drawingArea.startX, drawingArea.currentX);
      const y = Math.min(drawingArea.startY, drawingArea.currentY);
      const width = Math.abs(drawingArea.currentX - drawingArea.startX);
      const height = Math.abs(drawingArea.currentY - drawingArea.startY);

      const scaledDrawing = {
        x: x * scale,
        y: y * scale,
        width: width * scale,
        height: height * scale,
      };

      // Borde de selección
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(scaledDrawing.x, scaledDrawing.y, scaledDrawing.width, scaledDrawing.height);
      ctx.setLineDash([]);

      // Overlay semi-transparente
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(scaledDrawing.x, scaledDrawing.y, scaledDrawing.width, scaledDrawing.height);
    }
  };

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [blurAreas, drawingArea, isDrawing, imageLoaded]);

  // Obtener coordenadas del mouse o touch
  const getMousePos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        return { x: 0, y: 0 };
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / canvasScale,
      y: (clientY - rect.top) / canvasScale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setDrawingArea({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingArea) return;

    const pos = getMousePos(e);
    setDrawingArea({
      ...drawingArea,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawingArea) return;

    const x = Math.min(drawingArea.startX, drawingArea.currentX);
    const y = Math.min(drawingArea.startY, drawingArea.currentY);
    const width = Math.abs(drawingArea.currentX - drawingArea.startX);
    const height = Math.abs(drawingArea.currentY - drawingArea.startY);

    // Solo agregar si el área tiene un tamaño mínimo
    if (width > 20 && height > 20) {
      const newBlurArea: BlurArea = {
        id: `blur_${Date.now()}`,
        x: Math.max(0, Math.min(x, imageDimensions.width)),
        y: Math.max(0, Math.min(y, imageDimensions.height)),
        width: Math.min(width, imageDimensions.width - x),
        height: Math.min(height, imageDimensions.height - y),
        intensity: blurIntensity,
      };

      setBlurAreas([...blurAreas, newBlurArea]);
    }

    setIsDrawing(false);
    setDrawingArea(null);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getMousePos(e);
    setIsDrawing(true);
    setDrawingArea({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !drawingArea) return;

    const pos = getMousePos(e);
    setDrawingArea({
      ...drawingArea,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  };

  const handleRemoveLast = () => {
    if (blurAreas.length > 0) {
      setBlurAreas(blurAreas.slice(0, -1));
    }
  };

  const handleClearAll = () => {
    setBlurAreas([]);
  };

  // Generar imagen con blur aplicado
  const generateBlurredImage = async (): Promise<string | undefined> => {
    if (!imageRef.current || blurAreas.length === 0) {
      return undefined;
    }

    try {
      // Crear canvas temporal con dimensiones originales
      const canvas = document.createElement("canvas");
      canvas.width = imageDimensions.width;
      canvas.height = imageDimensions.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("No se pudo crear contexto del canvas");
        return undefined;
      }

      // Dibujar imagen original
      ctx.drawImage(imageRef.current, 0, 0, imageDimensions.width, imageDimensions.height);

      // Aplicar blur a cada área
      blurAreas.forEach((area) => {
        // Extraer el área a difuminar
        const imageData = ctx.getImageData(area.x, area.y, area.width, area.height);

        // Crear canvas temporal para el área
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = area.width;
        tempCanvas.height = area.height;
        const tempCtx = tempCanvas.getContext("2d");

        if (!tempCtx) return;

        // Dibujar el área en el canvas temporal
        tempCtx.putImageData(imageData, 0, 0);

        // Aplicar blur usando filter
        ctx.save();
        ctx.filter = `blur(${area.intensity || blurIntensity}px)`;
        ctx.drawImage(tempCanvas, area.x, area.y, area.width, area.height);
        ctx.restore();
      });

      // Convertir canvas a blob URL
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              console.log("✅ Imagen con blur generada:", url);
              resolve(url);
            } else {
              console.error("❌ Error generando blob de imagen");
              resolve(undefined);
            }
          },
          "image/jpeg",
          0.95
        );
      });
    } catch (error) {
      console.error("❌ Error generando imagen con blur:", error);
      return undefined;
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      // Generar imagen con blur aplicado si hay áreas marcadas
      let blurredImageUrl: string | undefined;
      if (blurAreas.length > 0) {
        blurredImageUrl = await generateBlurredImage();
      }

      await onBlurComplete(blurAreas, blurredImageUrl);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkipBlur = async () => {
    setProcessing(true);
    try {
      await onSkip();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* Instrucciones */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded w-full max-w-4xl">
        <p className="text-blue-800 font-medium mb-2">
          🔒 Protege la privacidad difuminando caras, matrículas u otras áreas sensibles
        </p>
        <p className="text-blue-700 text-sm">
          • Usa "Detectar Caras Automáticamente" para encontrar y marcar caras en la imagen
          <br />
          • O haz clic y arrastra manualmente para dibujar áreas a difuminar
          <br />
          • Puedes combinar ambos métodos y añadir múltiples áreas
          <br />• Si no necesitas difuminar nada, haz clic en "Continuar sin difuminar"
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-2 md:p-4 w-full max-w-4xl">
        {!imageLoaded ? (
          <div className="flex items-center justify-center w-full h-64 md:h-96 border border-gray-300 rounded bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">{loadingState}</p>
              {retryAttempt > 0 && (
                <p className="text-xs text-gray-400 mt-2">Esto puede tomar unos segundos...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-full overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="border border-gray-300 rounded cursor-crosshair touch-none max-w-full h-auto"
            />
          </div>
        )}
      </div>

      {/* Controles de áreas */}
      {imageLoaded && (
        <>
          {/* Botón de detección automática */}
          <div className="flex flex-col items-center gap-2 w-full max-w-md">
            <button
              onClick={detectFaces}
              disabled={isDetectingFaces || !modelsLoaded}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center font-medium"
            >
              {isDetectingFaces ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Detectando caras...
                </>
              ) : (
                <>
                  <Scan className="w-5 h-5" />
                  Detectar Caras Automáticamente
                </>
              )}
            </button>

            {/* Estado de la detección */}
            {faceDetectionStatus && (
              <p
                className={`text-sm ${
                  faceDetectionStatus.includes("Error") || faceDetectionStatus.includes("No se")
                    ? "text-orange-600"
                    : "text-green-600"
                } font-medium`}
              >
                {faceDetectionStatus}
              </p>
            )}

            {!modelsLoaded && !isDetectingFaces && (
              <p className="text-xs text-gray-500">Cargando modelos de detección...</p>
            )}
          </div>

          {/* Controles de eliminación */}
          <div className="flex flex-wrap gap-3 justify-center w-full max-w-md">
            <button
              onClick={handleRemoveLast}
              disabled={blurAreas.length === 0}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Última
            </button>
            <button
              onClick={handleClearAll}
              disabled={blurAreas.length === 0}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Limpiar Todo
            </button>
          </div>
        </>
      )}

      {/* Botones principales */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md">
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSkipBlur}
          disabled={!imageLoaded || processing}
          className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            "Continuar sin difuminar"
          )}
        </button>
        <button
          onClick={handleAccept}
          disabled={!imageLoaded || blurAreas.length === 0 || processing}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Aceptar y Continuar
            </>
          )}
        </button>
      </div>

      {imageLoaded && (
        <div className="text-sm text-gray-600 text-center max-w-md px-4">
          <p className="mb-1">
            {blurAreas.length === 0
              ? "Haz clic y arrastra sobre la imagen para marcar áreas a difuminar"
              : `${blurAreas.length} área(s) marcada(s) para difuminar`}
          </p>
          <p className="text-xs text-gray-500">
            Las áreas difuminadas aparecen con borde rojo punteado
          </p>
        </div>
      )}
    </div>
  );
}
