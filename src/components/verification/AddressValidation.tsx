"use client";

import { CheckCircle, AlertTriangle, MapPin, Loader2, Search, Edit2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
  observations?: string;
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
  observations,
  onValidationComplete,
}: AddressValidationProps) {
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [validated, setValidated] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Editable address fields
  const [addressForm, setAddressForm] = useState({
    street_type: currentAddress?.street_type || "",
    street_name: currentAddress?.street_name || "",
    street_number: currentAddress?.street_number || "",
    postal_code: currentAddress?.postal_code || "",
    latitude: currentAddress?.latitude,
    longitude: currentAddress?.longitude,
  });

  const hasAddress = addressForm.street_name || addressForm.street_type;
  const hasCoordinates = addressForm.latitude && addressForm.longitude;

  // Initialize map with OpenStreetMap
  useEffect(() => {
    if (!hasCoordinates || !mapRef.current) return;

    const loadMap = async () => {
      // Load Leaflet library
      if (!(window as any).L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => initializeMap();
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapRef.current || !addressForm.latitude || !addressForm.longitude) return;

      const L = (window as any).L;

      // Remove existing map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Create map
      const map = L.map(mapRef.current).setView([addressForm.latitude, addressForm.longitude], 16);

      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // Add marker
      const marker = L.marker([addressForm.latitude, addressForm.longitude], {
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;

      marker
        .bindPopup(
          `
        <b>Ubicación del DEA</b><br/>
        ${addressForm.street_type || ""} ${addressForm.street_name || ""} ${addressForm.street_number || ""}<br/>
        <small>Lat: ${addressForm.latitude.toFixed(6)}<br/>
        Lng: ${addressForm.longitude.toFixed(6)}</small>
      `
        )
        .openPopup();

      // Update coordinates when marker is dragged
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setAddressForm((prev) => ({
          ...prev,
          latitude: position.lat,
          longitude: position.lng,
        }));
      });

      setMapLoaded(true);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasCoordinates, addressForm.latitude, addressForm.longitude]);

  const geocodeAddress = async () => {
    if (!addressForm.street_name) {
      alert("Por favor ingresa al menos un nombre de calle");
      return;
    }

    setGeocoding(true);
    try {
      const query = `${addressForm.street_type || ""} ${addressForm.street_name} ${addressForm.street_number || ""} Madrid España`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        setAddressForm((prev) => ({
          ...prev,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
        }));
      } else {
        alert(
          "No se encontró la dirección. Por favor verifica los datos o coloca el marcador manualmente en el mapa."
        );
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      alert("Error al buscar la dirección");
    } finally {
      setGeocoding(false);
    }
  };

  const validateAddress = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setValidated(true);

      // Create validated address object
      const validatedAddress: AddressData = {
        street_type: addressForm.street_type || undefined,
        street_name: addressForm.street_name || undefined,
        street_number: addressForm.street_number || undefined,
        postal_code: addressForm.postal_code || undefined,
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
        confidence: hasCoordinates ? 0.95 : 0.5,
      };

      onValidationComplete(validatedAddress);
    } catch (error) {
      console.error("Error validating address:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Observations */}
      {observations && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Observaciones del Usuario</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{observations}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current/Editable Address Info */}
      <div
        className={`border rounded-lg p-4 ${hasAddress ? "bg-blue-50 border-blue-200" : "bg-yellow-50 border-yellow-200"}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            <MapPin
              className={`w-5 h-5 mt-0.5 ${hasAddress ? "text-blue-600" : "text-yellow-600"}`}
            />
            <h3 className="font-semibold text-gray-900">Dirección del DEA</h3>
          </div>
          {!editing && hasAddress && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              <span>Editar</span>
            </button>
          )}
        </div>

        {editing || !hasAddress ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de vía</label>
                <input
                  type="text"
                  value={addressForm.street_type}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, street_type: e.target.value }))
                  }
                  placeholder="Ej: Calle, Avenida..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de vía *
                </label>
                <input
                  type="text"
                  value={addressForm.street_name}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, street_name: e.target.value }))
                  }
                  placeholder="Ej: Ordicia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input
                  type="text"
                  value={addressForm.street_number}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, street_number: e.target.value }))
                  }
                  placeholder="Ej: 31"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <input
                  type="text"
                  value={addressForm.postal_code}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))
                  }
                  placeholder="Ej: 28001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={geocodeAddress}
                disabled={geocoding || !addressForm.street_name}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {geocoding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Buscar Coordenadas</span>
                  </>
                )}
              </button>
              {editing && (
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-700 mb-2">
              {addressForm.street_type && (
                <span className="font-medium">{addressForm.street_type} </span>
              )}
              {addressForm.street_name}
              {addressForm.street_number && <span> {addressForm.street_number}</span>}
            </p>
            {addressForm.postal_code && (
              <p className="text-sm text-gray-600 mt-1">Código Postal: {addressForm.postal_code}</p>
            )}
            {hasCoordinates ? (
              <p className="text-xs text-gray-500 mt-2 font-mono">
                📍 {addressForm.latitude!.toFixed(6)}, {addressForm.longitude!.toFixed(6)}
              </p>
            ) : (
              <p className="text-xs text-yellow-700 mt-2">
                ⚠️ No hay coordenadas GPS - Haz clic en &quot;Editar&quot; para buscarlas
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map Display */}
      {hasCoordinates ? (
        <div className="border rounded-lg overflow-hidden">
          <div ref={mapRef} className="w-full h-96 bg-gray-200" style={{ minHeight: "400px" }}>
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
              Mapa interactivo con OpenStreetMap. Puedes arrastrar el marcador para ajustar la
              ubicación exacta.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg bg-gray-50 p-8">
          <div className="text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-700 mb-1">Mapa no disponible</p>
            <p className="text-sm">Este DEA no tiene coordenadas GPS registradas.</p>
            {hasAddress && (
              <p className="text-xs mt-2">
                Haz clic en &quot;Buscar Coordenadas&quot; para geocodificar la dirección.
              </p>
            )}
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
                La dirección ha sido verificada correctamente. Puedes continuar con el siguiente
                paso.
              </p>
            </div>
          </div>
        </div>
      )}

      {!validated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 mb-1">Validación Requerida</h4>
              <p className="text-sm text-yellow-700 mb-3">
                Por favor, verifica que la dirección y la ubicación en el mapa sean correctas antes
                de continuar.
              </p>
              <button
                onClick={validateAddress}
                disabled={loading || !hasAddress}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 disabled:cursor-not-allowed flex items-center text-sm font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Validando...
                  </>
                ) : (
                  "Validar y Continuar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Link */}
      {(hasCoordinates || hasAddress) && (
        <div className="text-center">
          <a
            href={
              hasCoordinates
                ? `https://www.google.com/maps?q=${addressForm.latitude},${addressForm.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${addressForm.street_type || ""} ${addressForm.street_name || ""} ${addressForm.street_number || ""} Madrid España`
                  )}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <MapPin className="w-4 h-4 mr-1" />
            {hasCoordinates
              ? "Ver en Google Maps (coordenadas exactas)"
              : "Buscar en Google Maps (dirección)"}
          </a>
        </div>
      )}
    </div>
  );
}
