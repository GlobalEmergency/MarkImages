"use client";

import { CheckCircle, AlertTriangle, MapPin, Loader2, Search, Edit2, X } from "lucide-react";
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

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
  type?: string;
  source?: "google" | "osm";
}

export default function AddressValidation({
  _aedId,
  currentAddress,
  observations,
  onValidationComplete,
}: AddressValidationProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [validated, setValidated] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  // Initialize search query with current address for pre-filling
  const initialSearchQuery = currentAddress
    ? [currentAddress.street_type, currentAddress.street_name, currentAddress.street_number]
        .filter(Boolean)
        .join(" ")
    : "";

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Editable address fields
  const [addressForm, setAddressForm] = useState({
    street_type: currentAddress?.street_type || "",
    street_name: currentAddress?.street_name || "",
    street_number: currentAddress?.street_number || "",
    postal_code: currentAddress?.postal_code || "",
    locality: "Madrid", // Default locality
    latitude: currentAddress?.latitude,
    longitude: currentAddress?.longitude,
  });

  const hasAddress = addressForm.street_name || addressForm.street_type;
  const hasCoordinates = addressForm.latitude && addressForm.longitude;

  // Search addresses with debouncing
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Prepare search query - ensure it includes street prefix for better results
        let searchText = searchQuery.trim();

        // If query doesn't start with a street type, try to detect it and add "Calle" as default
        const streetTypes = [
          "Calle",
          "Avenida",
          "Plaza",
          "Paseo",
          "Travesía",
          "Glorieta",
          "Ronda",
          "Camino",
          "Carretera",
        ];
        const startsWithStreetType = streetTypes.some((type) =>
          searchText.toLowerCase().startsWith(type.toLowerCase())
        );

        if (!startsWithStreetType && searchText.length > 0) {
          searchText = `Calle ${searchText}`;
        }

        // Use our API endpoint that combines Google Geocoding and OSM results
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchText)}`);

        if (!response.ok) {
          throw new Error("Error fetching geocoding results");
        }

        const data = await response.json();

        // Filter and prioritize results with house numbers
        const resultsWithNumbers = data.filter((r: SearchResult) => r.address.house_number);
        const resultsWithoutNumbers = data.filter((r: SearchResult) => !r.address.house_number);

        // Prioritize results with house numbers, but keep some without numbers as fallback
        const prioritizedResults = [
          ...resultsWithNumbers.slice(0, 7),
          ...resultsWithoutNumbers.slice(0, 3),
        ];

        setSearchResults(prioritizedResults);
        setShowResults(true);
      } catch (error) {
        console.error("Error searching address:", error);
      } finally {
        setSearching(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

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

  const parseAddress = (result: SearchResult) => {
    // Extract street type from road name if possible
    const roadName = result.address.road || "";
    const streetTypes = [
      "Calle",
      "Avenida",
      "Plaza",
      "Paseo",
      "Travesía",
      "Glorieta",
      "Ronda",
      "Camino",
      "Carretera",
    ];
    let street_type = "";
    let street_name = roadName;

    for (const type of streetTypes) {
      if (roadName.startsWith(type + " ")) {
        street_type = type;
        street_name = roadName.substring(type.length + 1);
        break;
      }
    }

    // Get locality from various possible fields
    const locality =
      result.address.city ||
      result.address.town ||
      result.address.village ||
      result.address.municipality ||
      "Madrid";

    return {
      street_type: street_type || undefined,
      street_name: street_name || undefined,
      street_number: result.address.house_number || undefined,
      postal_code: result.address.postcode || undefined,
      locality: locality || undefined,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  };

  const selectSearchResult = (result: SearchResult) => {
    const parsedAddress = parseAddress(result);
    setAddressForm(parsedAddress as any);

    // Update search query with the selected address for easy modification
    const selectedAddressText = [
      parsedAddress.street_type,
      parsedAddress.street_name,
      parsedAddress.street_number,
    ]
      .filter(Boolean)
      .join(" ");

    setSearchQuery(selectedAddressText);
    setShowResults(false);
    setSearchResults([]);
    setEditing(false);
  };

  const validateAddress = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setValidated(true);

      // Create validated address object with all available data
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

      {/* Main Address Search - Prominent Single Field */}
      <div className="mb-6">
        <label className="block text-lg font-semibold text-gray-900 mb-3">
          Buscar y verificar dirección del DEA
        </label>
        <div className="relative">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Escribe la dirección completa (ej: Calle Gran Vía 28, Madrid)"
              className="w-full pl-12 pr-12 py-4 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm hover:border-gray-400"
            />
            {searchQuery && !searching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border-2 border-blue-200 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => selectSearchResult(result)}
                  className="w-full px-5 py-4 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors group"
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0 group-hover:text-blue-700" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-medium text-gray-900">
                          {result.address.road}
                          {result.address.house_number && ` ${result.address.house_number}`}
                        </p>
                        {result.address.house_number && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Nº exacto
                          </span>
                        )}
                        {result.source === "google" && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Google Maps
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{result.display_name}</p>
                      {!result.address.house_number && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ Sin número - ubicación aproximada de la calle
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {showResults && searchQuery.length >= 3 && searchResults.length === 0 && !searching && (
            <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-base text-gray-700 font-medium mb-1">
                No se encontraron resultados
              </p>
              <p className="text-sm text-gray-500">
                Intenta con otra búsqueda o edita la dirección manualmente más abajo
              </p>
            </div>
          )}

          {/* Search Hint */}
          {!searchQuery && !hasAddress && (
            <p className="mt-2 text-sm text-gray-500 flex items-center space-x-2">
              <span>💡</span>
              <span>Empieza a escribir para ver sugerencias automáticas de direcciones</span>
            </p>
          )}
        </div>
      </div>

      {/* Current/Editable Address Info - Only show if address exists */}
      {hasAddress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 mt-0.5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Dirección Seleccionada</h3>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar manualmente</span>
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de vía
                  </label>
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
                    placeholder="Ej: Gran Vía"
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
                    placeholder="Ej: 28"
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
                    placeholder="Ej: 28013"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
                <input
                  type="text"
                  value={addressForm.locality}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, locality: e.target.value }))
                  }
                  placeholder="Ej: Madrid"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Guardar cambios
                </button>
                <p className="text-xs text-gray-500">
                  O usa el buscador de arriba para seleccionar automáticamente
                </p>
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
                <p className="text-sm text-gray-600 mt-1">
                  Código Postal: {addressForm.postal_code}
                </p>
              )}
              {hasCoordinates ? (
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  📍 {addressForm.latitude!.toFixed(6)}, {addressForm.longitude!.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-yellow-700 mt-2">
                  ⚠️ No hay coordenadas GPS - Usa el buscador para encontrar la ubicación
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
            <p className="text-xs mt-2">
              Usa el buscador de direcciones para encontrar la ubicación automáticamente.
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
