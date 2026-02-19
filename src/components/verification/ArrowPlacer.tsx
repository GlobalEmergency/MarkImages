"use client";

import { useState, useEffect } from "react";

import type { ArrowData } from "@/types/shared";
import { ARROW_CONFIG } from "@/utils/arrowConstants";

interface ArrowPlacerProps {
  imageUrl: string;
  onArrowComplete: (arrowData: ArrowData, processedImageUrl?: string) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function ArrowPlacer({ imageUrl, onArrowComplete, onCancel }: ArrowPlacerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [arrowStart, setArrowStart] = useState<Point | null>(null);
  const [arrowEnd, setArrowEnd] = useState<Point | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Point | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [processing, setProcessing] = useState(false);

  // Cargar imagen
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setImageLoaded(true);
    };

    img.onerror = (error) => {
      console.error("Error loading image:", error);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  const getPointFromEvent = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    // Calcular coordenadas reales en la imagen
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const point = getPointFromEvent(e);

    if (!arrowStart) {
      // Primer clic: establecer punto de inicio
      setArrowStart(point);
      setPreviewEnd(null);
    } else if (!arrowEnd) {
      // Segundo clic: establecer punto final
      setArrowEnd(point);
      setPreviewEnd(null);
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (arrowStart && !arrowEnd) {
      // Mostrar preview de la flecha desde el inicio hasta el mouse
      const point = getPointFromEvent(e);
      setPreviewEnd(point);
    }
  };

  const handleImageMouseLeave = () => {
    if (arrowStart && !arrowEnd) {
      setPreviewEnd(null);
    }
  };

  const handleAccept = async () => {
    if (arrowStart && arrowEnd) {
      setProcessing(true);
      try {
        const arrowData: ArrowData = {
          id: `arrow_${Date.now()}`,
          startX: arrowStart.x,
          startY: arrowStart.y,
          endX: arrowEnd.x,
          endY: arrowEnd.y,
          color: "#dc2626",
          width: 40,
        };

        // Generar imagen procesada con la flecha dibujada
        try {
          const processedImageUrl = await generateProcessedImage(imageUrl, arrowData, imageDimensions);
          onArrowComplete(arrowData, processedImageUrl);
        } catch (error) {
          console.error("Error generating processed image:", error);
          // Continuar sin la imagen procesada
          onArrowComplete(arrowData);
        }
      } finally {
        setProcessing(false);
      }
    }
  };

  const generateProcessedImage = async (
    imageUrl: string,
    arrowData: ArrowData,
    dimensions: { width: number; height: number }
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Configurar tamaño del canvas
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Dibujar imagen base
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

        // Dibujar flecha
        const startX = arrowData.startX;
        const startY = arrowData.startY;
        const endX = arrowData.endX;
        const endY = arrowData.endY;

        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        const headLength = ARROW_CONFIG.HEAD_LENGTH;
        const bodyWidth = ARROW_CONFIG.BODY_WIDTH;

        // Dibujar cuerpo de la flecha
        ctx.strokeStyle = ARROW_CONFIG.COLOR;
        ctx.lineWidth = bodyWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX - headLength * Math.cos(angle), endY - headLength * Math.sin(angle));
        ctx.stroke();

        // Dibujar punta de la flecha
        ctx.fillStyle = ARROW_CONFIG.COLOR;
        ctx.strokeStyle = ARROW_CONFIG.STROKE_COLOR;
        ctx.lineWidth = ARROW_CONFIG.STROKE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Convertir a data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  };

  const reset = () => {
    setArrowStart(null);
    setArrowEnd(null);
    setPreviewEnd(null);
  };

  if (!imageLoaded) {
    return (
      <div className="flex items-center justify-center w-full h-96 border border-gray-300 rounded bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Cargando imagen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* Instrucciones */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded w-full max-w-4xl">
        <p className="text-blue-800 font-medium">
          {!arrowStart &&
            "🎯 Paso 1: Haz clic en la imagen para establecer el INICIO de la flecha (punto desde donde saldrá)"}
          {arrowStart &&
            !arrowEnd &&
            "🎯 Paso 2: Haz clic donde quieres que APUNTE la flecha (punto final)"}
          {arrowStart && arrowEnd && '✅ ¡Perfecto! Haz clic en "Aceptar Flecha" para continuar.'}
        </p>
      </div>

      {/* Imagen */}
      <div className="bg-white rounded-lg shadow-md p-2 md:p-4 relative w-full max-w-4xl">
        <div className="relative flex justify-center">
          <img
            src={imageUrl}
            alt="Imagen para colocar flecha"
            onClick={handleImageClick}
            onMouseMove={handleImageMouseMove}
            onMouseLeave={handleImageMouseLeave}
            className="w-full max-w-sm md:max-w-md lg:max-w-lg cursor-crosshair rounded shadow-sm aspect-square object-cover"
          />

          {/* Punto de inicio marcado */}
          {arrowStart && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              style={{ zIndex: 8 }}
            >
              <circle
                cx={arrowStart.x}
                cy={arrowStart.y}
                r="15"
                fill="#10b981"
                stroke="white"
                strokeWidth="3"
                opacity="0.9"
              />
              <text
                x={arrowStart.x}
                y={arrowStart.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize="16"
                fontWeight="bold"
              >
                1
              </text>
            </svg>
          )}

          {/* Preview de flecha SVG mientras se mueve el mouse */}
          {arrowStart && previewEnd && !arrowEnd && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              style={{ zIndex: 9 }}
            >
              {(() => {
                const startX = arrowStart.x;
                const startY = arrowStart.y;
                const endX = previewEnd.x;
                const endY = previewEnd.y;

                const dx = endX - startX;
                const dy = endY - startY;
                const angle = Math.atan2(dy, dx);

                const headLength = ARROW_CONFIG.HEAD_LENGTH;
                const bodyWidth = ARROW_CONFIG.BODY_WIDTH;

                return (
                  <g opacity="0.6">
                    {/* Cuerpo de la flecha */}
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX - headLength * Math.cos(angle)}
                      y2={endY - headLength * Math.sin(angle)}
                      stroke={ARROW_CONFIG.COLOR}
                      strokeWidth={bodyWidth}
                      strokeLinecap="round"
                    />

                    {/* Punta de la flecha */}
                    <polygon
                      points={`
                        ${endX},${endY}
                        ${endX - headLength * Math.cos(angle - Math.PI / 6)},${endY - headLength * Math.sin(angle - Math.PI / 6)}
                        ${endX - headLength * Math.cos(angle + Math.PI / 6)},${endY - headLength * Math.sin(angle + Math.PI / 6)}
                      `}
                      fill={ARROW_CONFIG.COLOR}
                      stroke={ARROW_CONFIG.STROKE_COLOR}
                      strokeWidth={ARROW_CONFIG.STROKE_WIDTH}
                    />
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Flecha SVG final completa */}
          {arrowStart && arrowEnd && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              style={{ zIndex: 10 }}
            >
              {(() => {
                const startX = arrowStart.x;
                const startY = arrowStart.y;
                const endX = arrowEnd.x;
                const endY = arrowEnd.y;

                const dx = endX - startX;
                const dy = endY - startY;
                const angle = Math.atan2(dy, dx);

                const headLength = ARROW_CONFIG.HEAD_LENGTH;
                const bodyWidth = ARROW_CONFIG.BODY_WIDTH;

                return (
                  <g>
                    {/* Cuerpo de la flecha */}
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX - headLength * Math.cos(angle)}
                      y2={endY - headLength * Math.sin(angle)}
                      stroke={ARROW_CONFIG.COLOR}
                      strokeWidth={bodyWidth}
                      strokeLinecap="round"
                    />

                    {/* Punta de la flecha */}
                    <polygon
                      points={`
                        ${endX},${endY}
                        ${endX - headLength * Math.cos(angle - Math.PI / 6)},${endY - headLength * Math.sin(angle - Math.PI / 6)}
                        ${endX - headLength * Math.cos(angle + Math.PI / 6)},${endY - headLength * Math.sin(angle + Math.PI / 6)}
                      `}
                      fill={ARROW_CONFIG.COLOR}
                      stroke={ARROW_CONFIG.STROKE_COLOR}
                      strokeWidth={ARROW_CONFIG.STROKE_WIDTH}
                    />

                    {/* Punto final marcado */}
                    <circle
                      cx={endX}
                      cy={endY}
                      r="12"
                      fill="#dc2626"
                      stroke="white"
                      strokeWidth="3"
                      opacity="0.9"
                    />
                    <text
                      x={endX}
                      y={endY + 5}
                      textAnchor="middle"
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      2
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md">
        <button
          onClick={reset}
          disabled={!arrowStart || processing}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reiniciar
        </button>
        <button
          onClick={onCancel}
          disabled={processing}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleAccept}
          disabled={!arrowStart || !arrowEnd || processing}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {processing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Procesando...
            </>
          ) : (
            "Aceptar Flecha"
          )}
        </button>
      </div>

      {/* Información adicional */}
      <div className="text-sm text-gray-600 text-center max-w-md">
        {!arrowStart && (
          <p>
            <span className="inline-block w-3 h-3 bg-green-600 rounded-full mr-2"></span>
            Haz clic en la imagen para marcar el punto de inicio de la flecha
          </p>
        )}
        {arrowStart && !arrowEnd && (
          <p>
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full mr-2 opacity-60"></span>
            Mueve el mouse y haz clic donde quieres que apunte la flecha
          </p>
        )}
        {arrowStart && arrowEnd && (
          <p>
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full mr-2"></span>✓ Flecha
            completa colocada. Desde el punto 1 hasta el punto 2.
          </p>
        )}
      </div>
    </div>
  );
}
