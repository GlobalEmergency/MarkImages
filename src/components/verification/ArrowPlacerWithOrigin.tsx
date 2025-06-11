'use client';

import { useState, useEffect } from 'react';
import type { ArrowData } from '@/types/shared';
import { ARROW_CONFIG } from '@/utils/arrowConstants';

interface ArrowPlacerWithOriginProps {
  imageUrl: string;
  onArrowComplete: (arrowData: ArrowData) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function ArrowPlacerWithOrigin({
  imageUrl,
  onArrowComplete,
  onCancel
}: ArrowPlacerWithOriginProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);
  const [step, setStep] = useState<'start' | 'end'>('start');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Cargar imagen
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setImageLoaded(true);
    };

    img.onerror = (error) => {
      console.error('Error loading image:', error);
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
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const point = getPointFromEvent(e);

    if (step === 'start') {
      setStartPoint(point);
      setStep('end');
      setPreviewPoint(null);
    } else if (step === 'end') {
      setEndPoint(point);
      setPreviewPoint(null);
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if ((step === 'start' && !startPoint) || (step === 'end' && !endPoint)) {
      const point = getPointFromEvent(e);
      setPreviewPoint(point);
    }
  };

  const handleImageMouseLeave = () => {
    setPreviewPoint(null);
  };

  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    setStep('start');
    setPreviewPoint(null);
  };

  const handleComplete = async () => {
    if (!startPoint || !endPoint) return;

    setIsLoading(true);
    try {
      const arrowData: ArrowData = {
        id: `arrow-${Date.now()}`,
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endPoint.x,
        endY: endPoint.y,
        color: '#dc2626',
        width: 4
      };

      await onArrowComplete(arrowData);
    } finally {
      setIsLoading(false);
    }
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
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Colocar Flecha Indicadora
        </h3>
        <div className="text-blue-700 space-y-2">
          {step === 'start' ? (
            <p>
              <span className="font-semibold">Paso 1:</span> Haz clic en el punto donde quieres que
              <span className="text-green-600 font-semibold"> INICIE </span>
              la flecha.
            </p>
          ) : !endPoint ? (
            <p>
              <span className="font-semibold">Paso 2:</span> Ahora haz clic en el punto donde quieres que
              <span className="text-red-600 font-semibold"> TERMINE </span>
              la flecha (ubicación del DEA).
            </p>
          ) : (
            <p className="text-green-700 font-semibold">
              ¡Perfecto! Flecha configurada correctamente. Haz clic en &quot;Completar Flecha&quot; para continuar.
            </p>
          )}
        </div>
      </div>

      {/* Imagen con SVG superpuesto */}
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

          {/* SVG superpuesto para dibujar puntos y flechas */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
            style={{ zIndex: 5 }}
          >
            {/* Preview del punto actual */}
            {previewPoint && (
              <g opacity="0.6">
                <circle
                  cx={previewPoint.x}
                  cy={previewPoint.y}
                  r="12"
                  fill={step === 'start' ? '#10b981' : '#dc2626'}
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <text
                  x={previewPoint.x}
                  y={previewPoint.y + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {step === 'start' ? 'INICIO' : 'FIN'}
                </text>
              </g>
            )}

            {/* Punto de inicio fijo */}
            {startPoint && (
              <g>
                <circle
                  cx={startPoint.x}
                  cy={startPoint.y}
                  r="12"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <text
                  x={startPoint.x}
                  y={startPoint.y + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                >
                  INICIO
                </text>
              </g>
            )}

            {/* Punto final fijo */}
            {endPoint && (
              <g>
                <circle
                  cx={endPoint.x}
                  cy={endPoint.y}
                  r="12"
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <text
                  x={endPoint.x}
                  y={endPoint.y + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                >
                  FIN
                </text>
              </g>
            )}

            {/* Flecha completa */}
            {startPoint && endPoint && (
              <g>
                {(() => {
                  const dx = endPoint.x - startPoint.x;
                  const dy = endPoint.y - startPoint.y;
                  const angle = Math.atan2(dy, dx);
                  const headLength = ARROW_CONFIG.HEAD_LENGTH;
                  const bodyWidth = ARROW_CONFIG.BODY_WIDTH;

                  return (
                    <>
                      {/* Cuerpo de la flecha */}
                      <line
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x - headLength * Math.cos(angle)}
                        y2={endPoint.y - headLength * Math.sin(angle)}
                        stroke={ARROW_CONFIG.COLOR}
                        strokeWidth={bodyWidth}
                        strokeLinecap="round"
                      />

                      {/* Punta de la flecha */}
                      <polygon
                        points={`
                          ${endPoint.x},${endPoint.y}
                          ${endPoint.x - headLength * Math.cos(angle - Math.PI / 6)},${endPoint.y - headLength * Math.sin(angle - Math.PI / 6)}
                          ${endPoint.x - headLength * Math.cos(angle + Math.PI / 6)},${endPoint.y - headLength * Math.sin(angle + Math.PI / 6)}
                        `}
                        fill={ARROW_CONFIG.COLOR}
                        stroke={ARROW_CONFIG.STROKE_COLOR}
                        strokeWidth={ARROW_CONFIG.STROKE_WIDTH}
                      />
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Estado actual */}
      {(startPoint || endPoint) && (
        <div className="bg-gray-50 rounded-lg p-4 w-full max-w-4xl">
          <h4 className="font-semibold mb-2">Estado actual:</h4>
          <div className="space-y-1 text-sm">
            {startPoint && (
              <p>✅ Punto de inicio seleccionado: ({Math.round(startPoint.x)}, {Math.round(startPoint.y)})</p>
            )}
            {endPoint && (
              <p>✅ Punto final seleccionado: ({Math.round(endPoint.x)}, {Math.round(endPoint.y)})</p>
            )}
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md">
        <button
          onClick={handleReset}
          disabled={!startPoint && !endPoint}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reiniciar
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          onClick={handleComplete}
          disabled={!startPoint || !endPoint || isLoading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Procesando...' : 'Completar Flecha'}
        </button>
      </div>

      {/* Información adicional */}
      <div className="text-sm text-gray-600 text-center max-w-md">
        {!startPoint && (
          <p>
            <span className="inline-block w-3 h-3 bg-green-600 rounded-full mr-2"></span>
            Selecciona el punto de inicio de la flecha
          </p>
        )}
        {startPoint && !endPoint && (
          <p>
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full mr-2"></span>
            Ahora selecciona dónde debe terminar la flecha
          </p>
        )}
        {startPoint && endPoint && (
          <p>
            <span className="inline-block w-3 h-3 bg-green-600 rounded-full mr-2"></span>
            Flecha configurada correctamente
          </p>
        )}
      </div>
    </div>
  );
}
