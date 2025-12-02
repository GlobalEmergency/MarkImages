"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface AddressData {
  street_type?: string;
  street_name?: string;
  street_number?: string;
  postal_code?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
}

interface AddressComparisonModalProps {
  isOpen: boolean;
  currentAddress: AddressData;
  suggestedAddress: AddressData;
  source: "google" | "osm";
  onConfirm: (selectedAddress: AddressData) => void;
  onCancel: () => void;
}

interface FieldSelection {
  street_type: "current" | "suggested";
  street_name: "current" | "suggested";
  street_number: "current" | "suggested";
  postal_code: "current" | "suggested";
  locality: "current" | "suggested";
  coordinates: "current" | "suggested";
}

export default function AddressComparisonModal({
  isOpen,
  currentAddress,
  suggestedAddress,
  source,
  onConfirm,
  onCancel,
}: AddressComparisonModalProps) {
  const [selectionMode, setSelectionMode] = useState<"current" | "suggested" | "manual">(
    "suggested"
  );
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>({
    street_type: "suggested",
    street_name: "suggested",
    street_number: "suggested",
    postal_code: "suggested",
    locality: "suggested",
    coordinates: "suggested",
  });

  if (!isOpen) return null;

  const hasCurrentCoordinates = currentAddress.latitude && currentAddress.longitude;
  const hasSuggestedCoordinates = suggestedAddress.latitude && suggestedAddress.longitude;

  // Check if values are different
  const isDifferent = (field: keyof AddressData) => {
    const current = currentAddress[field];
    const suggested = suggestedAddress[field];

    if (field === "latitude" || field === "longitude") {
      if (!current || !suggested) return true;
      return Math.abs(Number(current) - Number(suggested)) > 0.0001; // ~11m difference
    }

    return String(current || "").toLowerCase() !== String(suggested || "").toLowerCase();
  };

  const areCoodinatesDifferent =
    isDifferent("latitude") || isDifferent("longitude") || !hasCurrentCoordinates;

  const getFieldStyle = (field: keyof AddressData, isForCurrent: boolean) => {
    const isDiff = isDifferent(field);
    const isSelected =
      (isForCurrent && fieldSelection[field as keyof FieldSelection] === "current") ||
      (!isForCurrent && fieldSelection[field as keyof FieldSelection] === "suggested");

    if (selectionMode === "manual" && isSelected) {
      return "bg-blue-100 border-blue-500 border-2";
    }
    if (!isDiff) {
      return "bg-green-50 border-green-200";
    }
    return "bg-yellow-50 border-yellow-300";
  };

  const getCoordinatesStyle = (isForCurrent: boolean) => {
    const isSelected =
      (isForCurrent && fieldSelection.coordinates === "current") ||
      (!isForCurrent && fieldSelection.coordinates === "suggested");

    if (selectionMode === "manual" && isSelected) {
      return "bg-blue-100 border-blue-500 border-2";
    }
    if (!areCoodinatesDifferent) {
      return "bg-green-50 border-green-200";
    }
    return "bg-yellow-50 border-yellow-300";
  };

  const handleFieldToggle = (field: keyof FieldSelection) => {
    if (selectionMode !== "manual") return;

    setFieldSelection((prev) => ({
      ...prev,
      [field]: prev[field] === "current" ? "suggested" : "current",
    }));
  };

  const handleConfirm = () => {
    let finalAddress: AddressData;

    if (selectionMode === "current") {
      finalAddress = { ...currentAddress };
    } else if (selectionMode === "suggested") {
      finalAddress = { ...suggestedAddress };
    } else {
      // Manual selection - merge based on user choices
      finalAddress = {
        street_type:
          fieldSelection.street_type === "current"
            ? currentAddress.street_type
            : suggestedAddress.street_type,
        street_name:
          fieldSelection.street_name === "current"
            ? currentAddress.street_name
            : suggestedAddress.street_name,
        street_number:
          fieldSelection.street_number === "current"
            ? currentAddress.street_number
            : suggestedAddress.street_number,
        postal_code:
          fieldSelection.postal_code === "current"
            ? currentAddress.postal_code
            : suggestedAddress.postal_code,
        locality:
          fieldSelection.locality === "current"
            ? currentAddress.locality
            : suggestedAddress.locality,
        latitude:
          fieldSelection.coordinates === "current"
            ? currentAddress.latitude
            : suggestedAddress.latitude,
        longitude:
          fieldSelection.coordinates === "current"
            ? currentAddress.longitude
            : suggestedAddress.longitude,
      };
    }

    onConfirm(finalAddress);
  };

  const renderFieldComparison = (
    label: string,
    field: keyof AddressData,
    selectionKey: keyof FieldSelection
  ) => {
    const currentValue = currentAddress[field];
    const suggestedValue = suggestedAddress[field];
    const isDiff = isDifferent(field);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
          <div
            className={`p-3 rounded-lg border transition-all ${getFieldStyle(field, true)} ${
              selectionMode === "manual" ? "cursor-pointer hover:shadow-md" : ""
            }`}
            onClick={() => selectionMode === "manual" && handleFieldToggle(selectionKey)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {currentValue || <span className="text-gray-400 italic">Sin datos</span>}
              </span>
              {selectionMode === "manual" && fieldSelection[selectionKey] === "current" && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </div>
            {!isDiff && (
              <div className="flex items-center mt-1 text-xs text-green-700">
                <Check className="w-3 h-3 mr-1" />
                Igual
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {label}
            <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {source === "google" ? "Google Maps" : "OpenStreetMap"}
            </span>
          </label>
          <div
            className={`p-3 rounded-lg border transition-all ${getFieldStyle(field, false)} ${
              selectionMode === "manual" ? "cursor-pointer hover:shadow-md" : ""
            }`}
            onClick={() => selectionMode === "manual" && handleFieldToggle(selectionKey)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {suggestedValue || <span className="text-gray-400 italic">Sin datos</span>}
              </span>
              {selectionMode === "manual" && fieldSelection[selectionKey] === "suggested" && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </div>
            {isDiff && (
              <div className="flex items-center mt-1 text-xs text-yellow-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Diferente
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Map reference
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Initialize map with coordinates comparison
  useEffect(() => {
    if (!isOpen || (!hasCurrentCoordinates && !hasSuggestedCoordinates)) return;
    if (!mapRef.current) return;

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
      if (!mapRef.current) return;

      const L = (window as any).L;

      // Remove existing map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Determine center and bounds
      const bounds: [number, number][] = [];

      if (hasCurrentCoordinates) {
        bounds.push([currentAddress.latitude!, currentAddress.longitude!]);
      }

      if (hasSuggestedCoordinates) {
        bounds.push([suggestedAddress.latitude!, suggestedAddress.longitude!]);
      }

      // Create map
      const map = L.map(mapRef.current);
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // Custom icons
      const redIcon = L.divIcon({
        className: "custom-marker",
        html: '<div style="background-color: #dc2626; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><div style="transform: rotate(45deg); margin-top: 4px; margin-left: 8px; color: white; font-weight: bold; font-size: 16px;">📍</div></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const blueIcon = L.divIcon({
        className: "custom-marker",
        html: '<div style="background-color: #2563eb; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><div style="transform: rotate(45deg); margin-top: 4px; margin-left: 8px; color: white; font-weight: bold; font-size: 16px;">📍</div></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      // Add markers
      if (hasCurrentCoordinates) {
        const currentMarker = L.marker([currentAddress.latitude!, currentAddress.longitude!], {
          icon: redIcon,
        }).addTo(map);

        currentMarker.bindPopup(`
          <div style="min-width: 200px;">
            <b style="color: #dc2626;">🔴 Ubicación Original (BD)</b><br/>
            <div style="margin-top: 8px; font-size: 12px;">
              ${currentAddress.street_type || ""} ${currentAddress.street_name || ""} ${currentAddress.street_number || ""}<br/>
              <span style="font-family: monospace; color: #666;">
                Lat: ${currentAddress.latitude!.toFixed(6)}<br/>
                Lng: ${currentAddress.longitude!.toFixed(6)}
              </span>
            </div>
          </div>
        `);
      }

      if (hasSuggestedCoordinates) {
        const suggestedMarker = L.marker(
          [suggestedAddress.latitude!, suggestedAddress.longitude!],
          { icon: blueIcon }
        ).addTo(map);

        suggestedMarker.bindPopup(`
          <div style="min-width: 200px;">
            <b style="color: #2563eb;">🔵 Ubicación Geocoder (${source === "google" ? "Google Maps" : "OSM"})</b><br/>
            <div style="margin-top: 8px; font-size: 12px;">
              ${suggestedAddress.street_type || ""} ${suggestedAddress.street_name || ""} ${suggestedAddress.street_number || ""}<br/>
              <span style="font-family: monospace; color: #666;">
                Lat: ${suggestedAddress.latitude!.toFixed(6)}<br/>
                Lng: ${suggestedAddress.longitude!.toFixed(6)}
              </span>
            </div>
          </div>
        `);
      }

      // Fit bounds to show all markers
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 16);
      }
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [
    isOpen,
    hasCurrentCoordinates,
    hasSuggestedCoordinates,
    currentAddress,
    suggestedAddress,
    source,
  ]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              📍 Comparar Direcciones
            </h2>
            <p className="text-blue-100 text-sm mt-1">Selecciona qué datos deseas conservar</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-blue-800 p-2 rounded-lg transition-colors"
            aria-label="Cerrar modal de comparación"
            title="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Selection Mode */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              ¿Qué dirección deseas usar?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setSelectionMode("current")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectionMode === "current"
                    ? "border-blue-600 bg-blue-50 shadow-md"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold text-gray-900 mb-1">🏠 Mantener Original</div>
                  <div className="text-xs text-gray-600">Datos actuales en BD</div>
                </div>
              </button>

              <button
                onClick={() => setSelectionMode("suggested")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectionMode === "suggested"
                    ? "border-blue-600 bg-blue-50 shadow-md"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold text-gray-900 mb-1">✨ Usar del Geocoder</div>
                  <div className="text-xs text-gray-600">
                    {source === "google" ? "Google Maps" : "OpenStreetMap"}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectionMode("manual")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectionMode === "manual"
                    ? "border-blue-600 bg-blue-50 shadow-md"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold text-gray-900 mb-1">⚙️ Selección Manual</div>
                  <div className="text-xs text-gray-600">Campo por campo</div>
                </div>
              </button>
            </div>
          </div>

          {/* Field Comparison */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Comparación de Campos</h3>
              {selectionMode === "manual" && (
                <p className="text-sm text-blue-600">👆 Haz clic en un campo para seleccionarlo</p>
              )}
            </div>

            {/* Headers */}
            <div className="hidden md:grid grid-cols-2 gap-3 mb-2 pb-2 border-b">
              <div className="text-sm font-semibold text-gray-700">📦 Datos Actuales (BD)</div>
              <div className="text-sm font-semibold text-gray-700">
                🌐 Datos del Geocoder
                <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {source === "google" ? "Google Maps" : "OSM"}
                </span>
              </div>
            </div>

            {renderFieldComparison("Tipo de Vía", "street_type", "street_type")}
            {renderFieldComparison("Nombre de Vía", "street_name", "street_name")}
            {renderFieldComparison("Número", "street_number", "street_number")}
            {renderFieldComparison("Código Postal", "postal_code", "postal_code")}
            {renderFieldComparison("Localidad", "locality", "locality")}

            {/* Coordinates comparison */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Coordenadas GPS
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className={`p-3 rounded-lg border transition-all ${getCoordinatesStyle(true)} ${
                    selectionMode === "manual" ? "cursor-pointer hover:shadow-md" : ""
                  }`}
                  onClick={() => selectionMode === "manual" && handleFieldToggle("coordinates")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Actual</span>
                    {selectionMode === "manual" && fieldSelection.coordinates === "current" && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  {hasCurrentCoordinates ? (
                    <div className="font-mono text-xs text-gray-800">
                      <div>Lat: {currentAddress.latitude?.toFixed(6)}</div>
                      <div>Lng: {currentAddress.longitude?.toFixed(6)}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Sin coordenadas</span>
                  )}
                </div>

                <div
                  className={`p-3 rounded-lg border transition-all ${getCoordinatesStyle(
                    false
                  )} ${selectionMode === "manual" ? "cursor-pointer hover:shadow-md" : ""}`}
                  onClick={() => selectionMode === "manual" && handleFieldToggle("coordinates")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      {source === "google" ? "Google Maps" : "OSM"}
                    </span>
                    {selectionMode === "manual" && fieldSelection.coordinates === "suggested" && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  {hasSuggestedCoordinates ? (
                    <div className="font-mono text-xs text-gray-800">
                      <div>Lat: {suggestedAddress.latitude?.toFixed(6)}</div>
                      <div>Lng: {suggestedAddress.longitude?.toFixed(6)}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Sin coordenadas</span>
                  )}
                  {areCoodinatesDifferent && hasSuggestedCoordinates && hasCurrentCoordinates && (
                    <div className="flex items-center mt-2 text-xs text-yellow-700">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Coordenadas diferentes
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Map Comparison - Only show if there are coordinates */}
          {(hasCurrentCoordinates || hasSuggestedCoordinates) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                🗺️ Comparación Visual de Ubicación
              </h3>
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div
                  ref={mapRef}
                  className="w-full h-[400px] md:h-[450px]"
                  style={{ minHeight: "400px" }}
                ></div>
                <div className="bg-gray-50 px-4 py-3 border-t">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-4">
                      {hasCurrentCoordinates && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-red-600"></div>
                          <span className="text-gray-700 font-medium">Original (BD)</span>
                        </div>
                      )}
                      {hasSuggestedCoordinates && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                          <span className="text-gray-700 font-medium">
                            Geocoder ({source === "google" ? "Google" : "OSM"})
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-gray-600">
                      Haz clic en los marcadores para ver detalles
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Leyenda</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
                <span className="text-gray-600">Valores idénticos</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                <span className="text-gray-600">Valores diferentes</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
                <span className="text-gray-600">Campo seleccionado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            ✓ Confirmar y Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
