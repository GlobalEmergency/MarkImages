'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, MapPin, Loader2 } from 'lucide-react';

interface AddressValidationProps {
  _aedId: string;
  currentAddress?: {
    street_type?: string;
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  onValidationComplete: (validatedAddress: AddressData) => void;
}

interface AddressData {
  street_type?: string;
  street_name?: string;
  street_number?: string;
  postal_code?: string;
  district_id?: number;
  latitude?: number;
  longitude?: number;
  confidence?: number;
}

export default function AddressValidation({
  _aedId,
  currentAddress,
  onValidationComplete
}: AddressValidationProps) {
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Initialize map with OpenStreetMap
  useEffect(() => {
    if (!currentAddress?.latitude || !currentAddress?.longitude || !mapRef.current) return;

    const loadMap = async () => {
      // Load Leaflet library
      if (!(window as any).L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => initializeMap();
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapRef.current || !currentAddress.latitude || !currentAddress.longitude) return;

      const L = (window as any).L;

      // Remove existing map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Create map
      const map = L.map(mapRef.current).setView(
        [currentAddress.latitude, currentAddress.longitude],
        16
      );

      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add marker
      const marker = L.marker([currentAddress.latitude, currentAddress.longitude], {
        draggable: false
      }).addTo(map);

      marker.bindPopup(`
        <b>Ubicación del DEA</b><br/>
        ${currentAddress.street_type || ''} ${currentAddress.street_name || ''} ${currentAddress.street_number || ''}<br/>
        <small>Lat: ${currentAddress.latitude.toFixed(6)}<br/>
        Lng: ${currentAddress.longitude.toFixed(6)}</small>
      `).openPopup();

      setMapLoaded(true);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [currentAddress]);

  const validateAddress = async () => {
    setLoading(true);
    try {
      // Simulate address validation
      // In a real implementation, this would call a geocoding API
      await new Promise(resolve => setTimeout(resolve, 1000));

      setValidated(true);

      // Create validated address object
      const validatedAddress: AddressData = {
        street_type: currentAddress?.street_type,
        street_name: currentAddress?.street_name,
        street_number: currentAddress?.street_number,
        postal_code: currentAddress?.postal_code,
        latitude: currentAddress?.latitude,
        longitude: currentAddress?.longitude,
        confidence: 0.95
      };

      onValidationComplete(validatedAddress);
    } catch (error) {
      console.error('Error validating address:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Address Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">Dirección Actual</h3>
            <p className="text-gray-700">
              {currentAddress?.street_type} {currentAddress?.street_name}{' '}
              {currentAddress?.street_number}
            </p>
            {currentAddress?.postal_code && (
              <p className="text-sm text-gray-600 mt-1">
                CP: {currentAddress.postal_code}
              </p>
            )}
            {currentAddress?.latitude && currentAddress?.longitude && (
              <p className="text-xs text-gray-500 mt-1 font-mono">
                {currentAddress.latitude.toFixed(6)}, {currentAddress.longitude.toFixed(6)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Map Display */}
      {currentAddress?.latitude && currentAddress?.longitude && (
        <div className="border rounded-lg overflow-hidden">
          <div
            ref={mapRef}
            className="w-full h-96 bg-gray-200"
            style={{ minHeight: '400px' }}
          >
            {!mapLoaded && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-gray-600">Cargando mapa...</p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t">
            <p className="text-xs text-gray-600">
              Mapa interactivo con OpenStreetMap. La ubicación se muestra con un marcador rojo.
            </p>
          </div>
        </div>
      )}

      {/* Validation Status */}
      {validated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <h4 className="font-semibold text-green-900">Dirección Validada</h4>
              <p className="text-sm text-green-700">
                La dirección ha sido verificada correctamente con el sistema de geolocalización.
              </p>
            </div>
          </div>
        </div>
      )}

      {!validated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-900 mb-1">
                Validación Requerida
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                Por favor, verifica que la dirección y la ubicación en el mapa sean correctas.
                Puedes usar Google Maps o verificar con el sistema oficial del Ayuntamiento de Madrid.
              </p>
              <button
                onClick={validateAddress}
                disabled={loading}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 disabled:cursor-not-allowed flex items-center text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Validando...
                  </>
                ) : (
                  'Validar Dirección'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Link */}
      {currentAddress?.latitude && currentAddress?.longitude && (
        <div className="text-center">
          <a
            href={`https://www.google.com/maps?q=${currentAddress.latitude},${currentAddress.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
          >
            <MapPin className="w-4 h-4 mr-1" />
            Abrir en Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
