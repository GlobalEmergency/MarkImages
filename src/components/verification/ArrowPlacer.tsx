'use client';

import { useState, useEffect } from 'react';
import type { ArrowData } from '@/types/shared';
import { ARROW_CONFIG } from '@/utils/arrowConstants';

interface ArrowPlacerProps {
  imageUrl: string;
  onArrowComplete: (arrowData: ArrowData) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function ArrowPlacer({
  imageUrl,
  onArrowComplete,
  onCancel
}: ArrowPlacerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [arrowTip, setArrowTip] = useState<Point | null>(null);
  const [previewTip, setPreviewTip] = useState<Point | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

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
    setArrowTip(point);
    setPreviewTip(null); // Limpiar preview al hacer clic
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!arrowTip) { // Solo mostrar preview si no hay flecha fija
      const point = getPointFromEvent(e);
      setPreviewTip(point);
    }
  };

  const handleImageMouseLeave = () => {
    setPreviewTip(null); // Limpiar preview al salir
  };

  const handleAccept = () => {
    if (arrowTip) {
      // El punto de inicio siempre es el centro inferior
      const startPoint = {
        x: imageDimensions.width / 2,
        y: imageDimensions.height - 50
      };

      const arrowData: ArrowData = {
        id: `arrow_${Date.now()}`,
        startX: startPoint.x,
        startY: startPoint.y,
        endX: arrowTip.x,
        endY: arrowTip.y,
        color: '#dc2626',
        width: 40
      };
      onArrowComplete(arrowData);
    }
  };

  const reset = () => {
    setArrowTip(null);
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
          {arrowTip 
            ? '¡Perfecto! Haz clic en "Aceptar Flecha" para continuar.' 
            : 'Haz clic en la imagen donde quieres que apunte la flecha. La flecha saldrá desde el centro inferior.'
          }
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
          
          {/* Preview de flecha SVG */}
          {previewTip && !arrowTip && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              style={{ zIndex: 5 }}
            >
              {(() => {
                const startX = imageDimensions.width / 2;
                const startY = imageDimensions.height - 50;
                const endX = previewTip.x;
                const endY = previewTip.y;
                
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

          {/* Flecha SVG fija */}
          {arrowTip && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              style={{ zIndex: 10 }}
            >
              {(() => {
                const startX = imageDimensions.width / 2;
                const startY = imageDimensions.height - 50;
                const endX = arrowTip.x;
                const endY = arrowTip.y;
                
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
          disabled={!arrowTip}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reiniciar
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleAccept}
          disabled={!arrowTip}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Aceptar Flecha
        </button>
      </div>

      {/* Información adicional */}
      <div className="text-sm text-gray-600 text-center max-w-md">
        {!arrowTip && (
          <p>
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full mr-2 opacity-60"></span>
            Mueve el mouse sobre la imagen para ver una previsualización de la flecha
          </p>
        )}
        {arrowTip && (
          <p>
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full mr-2"></span>
            Flecha colocada correctamente. Sale del centro inferior y apunta al punto seleccionado.
          </p>
        )}
      </div>
    </div>
  );
}
