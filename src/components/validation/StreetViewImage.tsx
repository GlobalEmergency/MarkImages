'use client';

import { useState, useEffect } from 'react';

interface StreetViewImageProps {
  lat: number;
  lng: number;
  title: string;
  color: string;
  size?: string;
  heading?: number;
  pitch?: number;
}

export default function StreetViewImage({
  lat,
  lng,
  title,
  color,
  size = '400x300',
  heading = 0,
  pitch = 0
}: StreetViewImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentHeading, setCurrentHeading] = useState(heading);
  const [currentPitch, setCurrentPitch] = useState(pitch);

  // Construir URL de Google Street View Static API
  const getStreetViewUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return null;
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/streetview';
    const params = new URLSearchParams({
      size,
      location: `${lat},${lng}`,
      heading: currentHeading.toString(),
      pitch: currentPitch.toString(),
      key: apiKey,
      radius: '500',
      fov: '90' // Campo de visión
    });

    return `${baseUrl}?${params.toString()}`;
  };

  // Funciones de control
  const rotateLeft = () => setCurrentHeading(prev => (prev - 30 + 360) % 360);
  const rotateRight = () => setCurrentHeading(prev => (prev + 30) % 360);
  const resetView = () => {
    setCurrentHeading(0);
    setCurrentPitch(0);
  };

  // Función para abrir Google Maps con Street View
  const openInGoogleMaps = () => {
    const googleMapsUrl = `https://www.google.com/maps/@${lat},${lng},3a,75y,${currentHeading}h,90t/data=!3m6!1e1!3m4!1s0x0:0x0!2e0!7i16384!8i8192`;
    window.open(googleMapsUrl, '_blank');
  };

  // Resetear estado de carga cuando cambien los parámetros
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [currentHeading, currentPitch]);

  const streetViewUrl = getStreetViewUrl();

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  if (!streetViewUrl) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div 
          className="w-full h-48 rounded border-2 border-dashed flex items-center justify-center"
          style={{ borderColor: color }}
        >
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">🗺️</div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs mt-1">API key no configurada</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="mb-3">
        <div className="flex items-center">
          <div 
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: color }}
          ></div>
          <span className="font-medium text-gray-800">{title}</span>
        </div>
      </div>

      {/* Botón para abrir en Google Maps */}
      <div className="flex items-center justify-center mb-2">
        <button
          onClick={openInGoogleMaps}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors flex items-center"
          title="Abrir en Google Maps"
        >
          🗺️ Abrir en Google Maps
        </button>
      </div>

      <div className="relative">
        {imageLoading && (
          <div 
            className="w-full h-48 rounded border-2 border-dashed flex items-center justify-center animate-pulse"
            style={{ borderColor: color }}
          >
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">📷</div>
              <div className="text-sm">Cargando Street View...</div>
            </div>
          </div>
        )}

        {imageError ? (
          <div 
            className="w-full h-48 rounded border-2 border-dashed flex items-center justify-center"
            style={{ borderColor: color }}
          >
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">🚫</div>
              <div className="text-sm font-medium">Street View no disponible</div>
              <div className="text-xs mt-1">
                No hay imágenes para esta ubicación
              </div>
            </div>
          </div>
        ) : (
          <img
            src={streetViewUrl}
            alt={`Street View - ${title}`}
            className={`w-full h-48 object-cover rounded border-2 ${imageLoading ? 'hidden' : 'block'}`}
            style={{ borderColor: color }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>

      {/* Controles de rotación */}
      {!imageError && (
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <button
              onClick={rotateLeft}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
              title="Girar izquierda (-30°)"
            >
              ⬅️
            </button>
            <button
              onClick={resetView}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
              title="Reset vista (0°)"
            >
              🧭
            </button>
            <button
              onClick={rotateRight}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
              title="Girar derecha (+30°)"
            >
              ➡️
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
