"use client";

import { CheckCircle, AlertTriangle, MapPin, Loader2, Search, Edit2, X, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import ObservationsDisplay from "./ObservationsDisplay";

interface AddressValidationProps {
  _aedId: string;
  currentAddress?: Partial<AddressData>;
  observations?: string;
  onValidationComplete: (validatedAddress: AddressData) => void;
}

// Interfaz completa con campos de AedLocation (v2)
interface AddressData {
  // Dirección básica
  street_type?: string;
  street_name?: string;
  street_number?: string;
  postal_code?: string;

  // Coordenadas (now in Aed, but kept here for validation flow)
  latitude?: number;
  longitude?: number;
  coordinates_precision?: string;

  // Geografía
  city_name?: string;
  city_code?: string;
  district_code?: string;
  district_name?: string;
  neighborhood_code?: string;
  neighborhood_name?: string;
  autonomous_community?: string;
  country?: string;

  // Acceso y ubicación (v2 - simplified)
  floor?: string;
  location_details?: string;
  access_instructions?: string;

  // Legacy fields (for backwards compatibility in validation flow)
  additional_info?: string;
  specific_location?: string;
  access_description?: string;
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
    autonomous_community?: string;
    country?: string;
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

  // Comparison state
  const [showingComparison, setShowingComparison] = useState(false);
  const [suggestedAddress, setSuggestedAddress] = useState<AddressData | null>(null);
  const [comparisonSource, setComparisonSource] = useState<"google" | "osm">("osm");

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
  const currentMarkerRef = useRef<any>(null);
  const suggestedMarkerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track whether the last coordinate change came from a marker drag
  // to prevent the map useEffect from needlessly re-creating the map.
  const dragOriginRef = useRef(false);

  // Editable address fields
  const [addressForm, setAddressForm] = useState<AddressData>({
    street_type: currentAddress?.street_type || "",
    street_name: currentAddress?.street_name || "",
    street_number: currentAddress?.street_number || "",
    postal_code: currentAddress?.postal_code || "",
    latitude: currentAddress?.latitude,
    longitude: currentAddress?.longitude,
    coordinates_precision: currentAddress?.coordinates_precision,
    city_name: currentAddress?.city_name || "",
    city_code: currentAddress?.city_code,
    district_code: currentAddress?.district_code,
    district_name: currentAddress?.district_name,
    neighborhood_code: currentAddress?.neighborhood_code,
    neighborhood_name: currentAddress?.neighborhood_name,
    autonomous_community: currentAddress?.autonomous_community || "",
    country: currentAddress?.country || "España",
    floor: currentAddress?.floor,
    location_details: currentAddress?.location_details || currentAddress?.specific_location || "",
    access_instructions:
      currentAddress?.access_instructions || currentAddress?.access_description || "",
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
        let searchText = searchQuery.trim();

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

        // Build URL with geographic context from current DEA data
        const params = new URLSearchParams({ q: searchText });

        // Add city context if available (don't force Madrid)
        if (currentAddress?.city_name) {
          params.append("city", currentAddress.city_name);
        }

        // Add postal code context if available
        if (currentAddress?.postal_code) {
          params.append("postalCode", currentAddress.postal_code);
        }

        // Add country context - default to España only if no country specified
        // For now we assume Spain, but this could be extended
        params.append("country", "España");

        const response = await fetch(`/api/geocode?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Error fetching geocoding results");
        }

        const data = await response.json();

        const resultsWithNumbers = data.filter((r: SearchResult) => r.address.house_number);
        const resultsWithoutNumbers = data.filter((r: SearchResult) => !r.address.house_number);

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
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Initialize map with OpenStreetMap
  useEffect(() => {
    if (!mapRef.current) return;
    if (!hasCoordinates && !suggestedAddress?.latitude) return;

    // When coordinates changed via marker drag, just update the popup — don't
    // tear down and rebuild the entire map (which causes a visual flash).
    if (dragOriginRef.current) {
      dragOriginRef.current = false;
      // Update popup content with new coordinates
      if (currentMarkerRef.current && addressForm.latitude && addressForm.longitude) {
        currentMarkerRef.current.setPopupContent(`
          <div style="min-width: 200px;">
            <b style="color: #dc2626;">🔴 Ubicación Actual</b><br/>
            <div style="margin-top: 8px; font-size: 12px;">
              ${addressForm.street_type || ""} ${addressForm.street_name || ""} ${addressForm.street_number || ""}<br/>
              <span style="font-family: monospace; color: #666;">
                Lat: ${addressForm.latitude.toFixed(6)}<br/>
                Lng: ${addressForm.longitude.toFixed(6)}
              </span><br/>
              <span style="color: #059669; font-size: 11px;">📍 Posición ajustada manualmente</span>
            </div>
          </div>
        `);
      }
      return;
    }

    const loadMap = async () => {
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
        mapInstanceRef.current = null;
        currentMarkerRef.current = null;
        suggestedMarkerRef.current = null;
      }

      // Determine bounds
      const bounds: [number, number][] = [];

      if (hasCoordinates) {
        bounds.push([addressForm.latitude!, addressForm.longitude!]);
      }

      if (suggestedAddress?.latitude && suggestedAddress?.longitude) {
        bounds.push([suggestedAddress.latitude, suggestedAddress.longitude]);
      }

      if (bounds.length === 0) return;

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
      if (hasCoordinates) {
        const currentMarker = L.marker([addressForm.latitude!, addressForm.longitude!], {
          icon: redIcon,
          draggable: !showingComparison,
        }).addTo(map);

        currentMarkerRef.current = currentMarker;

        currentMarker.bindPopup(`
          <div style="min-width: 200px;">
            <b style="color: #dc2626;">🔴 Ubicación Actual (BD)</b><br/>
            <div style="margin-top: 8px; font-size: 12px;">
              ${addressForm.street_type || ""} ${addressForm.street_name || ""} ${addressForm.street_number || ""}<br/>
              <span style="font-family: monospace; color: #666;">
                Lat: ${addressForm.latitude!.toFixed(6)}<br/>
                Lng: ${addressForm.longitude!.toFixed(6)}
              </span>
            </div>
          </div>
        `);

        // Update coordinates when marker is dragged (only if not comparing)
        if (!showingComparison) {
          currentMarker.on("dragend", () => {
            const position = currentMarker.getLatLng();
            // Flag so the map useEffect skips recreation on this change
            dragOriginRef.current = true;
            setAddressForm((prev) => ({
              ...prev,
              latitude: position.lat,
              longitude: position.lng,
              coordinates_precision: "USER_PLACED",
            }));
          });
        }
      }

      if (suggestedAddress?.latitude && suggestedAddress?.longitude) {
        const suggestedMarker = L.marker([suggestedAddress.latitude, suggestedAddress.longitude], {
          icon: blueIcon,
        }).addTo(map);

        suggestedMarkerRef.current = suggestedMarker;

        suggestedMarker.bindPopup(`
          <div style="min-width: 200px;">
            <b style="color: #2563eb;">🔵 Ubicación Geocoder (${comparisonSource === "google" ? "Google Maps" : "OSM"})</b><br/>
            <div style="margin-top: 8px; font-size: 12px;">
              ${suggestedAddress.street_type || ""} ${suggestedAddress.street_name || ""} ${suggestedAddress.street_number || ""}<br/>
              <span style="font-family: monospace; color: #666;">
                Lat: ${suggestedAddress.latitude.toFixed(6)}<br/>
                Lng: ${suggestedAddress.longitude.toFixed(6)}
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

      setMapLoaded(true);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [
    hasCoordinates,
    addressForm.latitude,
    addressForm.longitude,
    suggestedAddress,
    showingComparison,
    comparisonSource,
  ]);

  const parseAddress = (result: SearchResult): AddressData => {
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

    const city_name =
      result.address.city ||
      result.address.town ||
      result.address.village ||
      result.address.municipality ||
      "";

    return {
      street_type: street_type || undefined,
      street_name: street_name || undefined,
      street_number: result.address.house_number || undefined,
      postal_code: result.address.postcode || undefined,
      city_name: city_name || undefined,
      autonomous_community: result.address.autonomous_community || undefined,
      country: result.address.country || undefined,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  };

  const selectSearchResult = (result: SearchResult) => {
    const parsed = parseAddress(result);
    setSuggestedAddress(parsed);
    setComparisonSource(result.source || "osm");
    setShowingComparison(true);
    setShowResults(false);
  };

  const applyCurrentAddress = () => {
    // Keep current address
    setShowingComparison(false);
    setSuggestedAddress(null);
  };

  const applySuggestedAddress = () => {
    if (suggestedAddress) {
      setAddressForm(suggestedAddress);
      setShowingComparison(false);
      setSuggestedAddress(null);

      // Update search query
      const selectedAddressText = [
        suggestedAddress.street_type,
        suggestedAddress.street_name,
        suggestedAddress.street_number,
      ]
        .filter(Boolean)
        .join(" ");
      setSearchQuery(selectedAddressText);
    }
  };

  const applyMixedAddress = (field: keyof AddressData, source: "current" | "suggested") => {
    if (source === "suggested" && suggestedAddress) {
      setAddressForm((prev) => ({
        ...prev,
        [field]: suggestedAddress[field],
      }));
    }
    // If current, no action needed as addressForm already has current values
  };

  const cancelComparison = () => {
    setShowingComparison(false);
    setSuggestedAddress(null);
  };

  const validateAddress = async () => {
    console.log("=== Starting address validation ===");
    console.log("Address form data:", addressForm);

    setLoading(true);
    try {
      setValidated(true);

      const validatedAddress: AddressData = {
        ...addressForm,
        // Ensure coordinates precision if coordinates exist
        coordinates_precision: hasCoordinates
          ? addressForm.coordinates_precision || "ROOFTOP"
          : undefined,
      };

      console.log("Validated address:", validatedAddress);
      // Parent calls updateStep which triggers a re-render that unmounts us.
      // Keep loading=true so the spinner stays visible until the step transitions.
      onValidationComplete(validatedAddress);
    } catch (error) {
      console.error("Error validating address:", error);
      setLoading(false);
    }
  };

  const isDifferent = (field: keyof AddressData) => {
    if (!suggestedAddress) return false;
    const current = addressForm[field];
    const suggested = suggestedAddress[field];

    if (field === "latitude" || field === "longitude") {
      if (!current || !suggested) return true;
      return Math.abs(Number(current) - Number(suggested)) > 0.0001;
    }

    return String(current || "").toLowerCase() !== String(suggested || "").toLowerCase();
  };

  const renderFieldComparison = (
    label: string,
    field: keyof AddressData,
    showInComparison: boolean = true
  ) => {
    if (!showInComparison || !showingComparison || !suggestedAddress) return null;

    const currentValue = addressForm[field];
    const suggestedValue = suggestedAddress[field];
    const isDiff = isDifferent(field);

    // Si NO viene del geocoder (solo hay valor actual o ninguno), mostrar solo lado del usuario
    if (!suggestedValue) {
      return (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
          <input
            type="text"
            value={currentValue || ""}
            onChange={(e) => setAddressForm((prev) => ({ ...prev, [field]: e.target.value }))}
            placeholder={`Escribe ${label.toLowerCase()}...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      );
    }

    // Comparación normal lado a lado (cuando SÍ viene del geocoder)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{label} (Actual)</label>
          <div
            className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
              isDiff ? "bg-yellow-50 border-yellow-300" : "bg-green-50 border-green-200"
            }`}
            onClick={() => applyMixedAddress(field, "current")}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {currentValue || <span className="text-gray-400 italic">Sin datos</span>}
              </span>
              {!isDiff && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {label} (Sugerido)
            <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {comparisonSource === "google" ? "Google" : "OSM"}
            </span>
          </label>
          <div
            className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
              isDiff ? "bg-blue-50 border-blue-300" : "bg-green-50 border-green-200"
            }`}
            onClick={() => isDiff && applyMixedAddress(field, "suggested")}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {suggestedValue || <span className="text-gray-400 italic">Sin datos</span>}
              </span>
              {isDiff && <Check className="w-4 h-4 text-blue-600" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Observations */}
      <ObservationsDisplay observations={observations} title="Observaciones del Usuario" />

      {/* Main Address Search */}
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
              disabled={showingComparison}
            />
            {searchQuery && !searching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Limpiar búsqueda"
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
          {showResults && searchResults.length > 0 && !showingComparison && (
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
                          ⚠️ Sin número - ubicación aproximada
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
                Intenta con otra búsqueda o edita la dirección manualmente
              </p>
            </div>
          )}

          {/* Search Hint */}
          {!searchQuery && !hasAddress && !showingComparison && (
            <p className="mt-2 text-sm text-gray-500 flex items-center space-x-2">
              <span>💡</span>
              <span>Empieza a escribir para ver sugerencias automáticas</span>
            </p>
          )}
        </div>
      </div>

      {/* Address Comparison - Inline */}
      {showingComparison && suggestedAddress && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-900">📍 Comparar Direcciones</h3>
            <button
              onClick={cancelComparison}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Cancelar comparación
            </button>
          </div>

          <p className="text-sm text-blue-800">
            Selecciona qué dirección deseas usar. Haz clic en los campos sugeridos para aplicarlos.
          </p>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={applyCurrentAddress}
              className="p-3 rounded-lg border-2 border-red-300 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <div className="text-center">
                <div className="font-semibold text-red-900 mb-1">🔴 Mantener Actual</div>
                <div className="text-xs text-red-700">Datos en BD</div>
              </div>
            </button>

            <button
              onClick={applySuggestedAddress}
              className="p-3 rounded-lg border-2 border-blue-500 bg-blue-100 hover:bg-blue-200 transition-colors"
            >
              <div className="text-center">
                <div className="font-semibold text-blue-900 mb-1">🔵 Usar Sugerido</div>
                <div className="text-xs text-blue-700">
                  {comparisonSource === "google" ? "Google Maps" : "OpenStreetMap"}
                </div>
              </div>
            </button>
          </div>

          {/* Field Comparison */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-blue-900">
              Comparación Campo por Campo
              <span className="ml-2 text-xs font-normal text-blue-700">
                (Haz clic en un campo sugerido para aplicarlo)
              </span>
            </h4>

            <h5 className="text-xs font-semibold text-blue-800 mt-4 mb-2">📍 Dirección Básica</h5>
            {renderFieldComparison("Tipo de Vía", "street_type")}
            {renderFieldComparison("Nombre de Vía", "street_name")}
            {renderFieldComparison("Número", "street_number")}
            {renderFieldComparison("Información Adicional", "additional_info")}

            <h5 className="text-xs font-semibold text-blue-800 mt-4 mb-2">🌍 Geografía</h5>
            {renderFieldComparison("Código Postal", "postal_code")}
            {renderFieldComparison("Ciudad", "city_name")}
            {renderFieldComparison("Distrito", "district_name")}
            {renderFieldComparison("Barrio", "neighborhood_name")}
            {renderFieldComparison("Comunidad Autónoma", "autonomous_community")}
            {renderFieldComparison("País", "country")}

            <h5 className="text-xs font-semibold text-blue-800 mt-4 mb-2">
              🏢 Ubicación Detallada
            </h5>
            {renderFieldComparison("Piso", "floor", true)}
            {renderFieldComparison("Ubicación Específica", "location_details", true)}

            <h5 className="text-xs font-semibold text-blue-800 mt-4 mb-2">🚪 Acceso</h5>
            {renderFieldComparison("Instrucciones de Acceso", "access_instructions", true)}

            {/* Coordinates - Mejoradas */}
            {(addressForm.latitude || suggestedAddress?.latitude) && (
              <>
                <h5 className="text-xs font-semibold text-blue-800 mt-4 mb-2">
                  📡 Coordenadas GPS
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Coordenadas (Actual)
                    </label>
                    <div
                      className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                        addressForm.latitude &&
                        suggestedAddress?.latitude &&
                        Math.abs(addressForm.latitude - suggestedAddress.latitude) < 0.0001 &&
                        Math.abs(addressForm.longitude! - suggestedAddress.longitude!) < 0.0001
                          ? "bg-green-50 border-green-200"
                          : "bg-yellow-50 border-yellow-300"
                      }`}
                      onClick={() => {
                        if (currentAddress?.latitude && currentAddress?.longitude) {
                          setAddressForm((prev) => ({
                            ...prev,
                            latitude: currentAddress.latitude,
                            longitude: currentAddress.longitude,
                          }));
                        }
                      }}
                    >
                      {addressForm.latitude && addressForm.longitude ? (
                        <div>
                          <div className="font-mono text-xs text-gray-800">
                            <div>Lat: {addressForm.latitude.toFixed(6)}</div>
                            <div>Lng: {addressForm.longitude.toFixed(6)}</div>
                          </div>
                          {addressForm.latitude &&
                            suggestedAddress?.latitude &&
                            Math.abs(addressForm.latitude - suggestedAddress.latitude) < 0.0001 &&
                            Math.abs(addressForm.longitude! - suggestedAddress.longitude!) <
                              0.0001 && (
                              <div className="flex items-center text-xs text-green-700 mt-1">
                                <Check className="w-3 h-3 mr-1" />
                                Coinciden
                              </div>
                            )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Sin coordenadas</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Coordenadas (Sugerido)
                      <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {comparisonSource === "google" ? "Google" : "OSM"}
                      </span>
                    </label>
                    <div
                      className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                        addressForm.latitude &&
                        suggestedAddress.latitude &&
                        Math.abs(addressForm.latitude - suggestedAddress.latitude) < 0.0001 &&
                        Math.abs(addressForm.longitude! - suggestedAddress.longitude!) < 0.0001
                          ? "bg-green-50 border-green-200"
                          : "bg-blue-50 border-blue-300"
                      }`}
                      onClick={() => {
                        if (suggestedAddress.latitude && suggestedAddress.longitude) {
                          setAddressForm((prev) => ({
                            ...prev,
                            latitude: suggestedAddress.latitude,
                            longitude: suggestedAddress.longitude,
                          }));
                        }
                      }}
                    >
                      {suggestedAddress.latitude && suggestedAddress.longitude ? (
                        <div>
                          <div className="font-mono text-xs text-gray-800 mb-1">
                            <div>Lat: {suggestedAddress.latitude.toFixed(6)}</div>
                            <div>Lng: {suggestedAddress.longitude.toFixed(6)}</div>
                          </div>
                          <div className="flex items-center text-xs text-blue-700">
                            <Check className="w-3 h-3 mr-1" />
                            Clic para aplicar
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Sin coordenadas</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Current Address Display */}
      {hasAddress && !showingComparison && (
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
                <span>Editar</span>
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">📍 Dirección</h5>
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
                  Información Adicional
                </label>
                <input
                  type="text"
                  value={addressForm.additional_info || ""}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, additional_info: e.target.value }))
                  }
                  placeholder="Ej: Portal B, Escalera 2..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <h5 className="text-xs font-semibold text-gray-700 mb-2 mt-4">🌍 Geografía</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={addressForm.postal_code || ""}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))
                    }
                    placeholder="Ej: 28013"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={addressForm.city_name || ""}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, city_name: e.target.value }))
                    }
                    placeholder="Ej: Madrid, Barcelona..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comunidad Autónoma
                  </label>
                  <input
                    type="text"
                    value={addressForm.autonomous_community || ""}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, autonomous_community: e.target.value }))
                    }
                    placeholder="Ej: Comunidad de Madrid, Cataluña..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input
                    type="text"
                    value={addressForm.country || "España"}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, country: e.target.value }))
                    }
                    placeholder="Ej: España"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <h5 className="text-xs font-semibold text-gray-700 mb-2 mt-4">
                🏢 Ubicación Detallada
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                  <input
                    type="text"
                    value={addressForm.floor || ""}
                    onChange={(e) => setAddressForm((prev) => ({ ...prev, floor: e.target.value }))}
                    placeholder="Ej: 3º, Planta Baja..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detalles de Ubicación
                  </label>
                  <input
                    type="text"
                    value={addressForm.location_details || ""}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, location_details: e.target.value }))
                    }
                    placeholder="Ej: Recepción, Vestíbulo, Junto a la escalera..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <h5 className="text-xs font-semibold text-gray-700 mb-2 mt-4">🚪 Acceso</h5>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de Acceso
                </label>
                <textarea
                  value={addressForm.access_instructions || ""}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, access_description: e.target.value }))
                  }
                  placeholder="Ej: Entrar por la puerta principal, girar a la derecha..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  ✓ Guardar cambios
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    // Reset to currentAddress
                    if (currentAddress) {
                      setAddressForm({
                        ...currentAddress,
                        street_type: currentAddress.street_type || "",
                        street_name: currentAddress.street_name || "",
                        street_number: currentAddress.street_number || "",
                        city_name: currentAddress.city_name || "",
                      });
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Cancelar
                </button>
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
              {/* Geografía */}
              <div className="text-sm text-gray-600 mt-2 space-y-1">
                {(addressForm.postal_code || addressForm.city_name) && (
                  <p>
                    {addressForm.postal_code && <span>{addressForm.postal_code}</span>}
                    {addressForm.postal_code && addressForm.city_name && <span> - </span>}
                    {addressForm.city_name && <span>{addressForm.city_name}</span>}
                  </p>
                )}
                {(addressForm.autonomous_community || addressForm.country) && (
                  <p>
                    {addressForm.autonomous_community && (
                      <span>{addressForm.autonomous_community}</span>
                    )}
                    {addressForm.autonomous_community && addressForm.country && <span>, </span>}
                    {addressForm.country && <span>{addressForm.country}</span>}
                  </p>
                )}
              </div>
              {hasCoordinates ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 font-mono">
                    📍 {addressForm.latitude!.toFixed(6)}, {addressForm.longitude!.toFixed(6)}
                  </p>
                  {currentAddress?.latitude &&
                    currentAddress?.longitude &&
                    (Math.abs(addressForm.latitude! - currentAddress.latitude) > 0.00001 ||
                      Math.abs(addressForm.longitude! - currentAddress.longitude) > 0.00001) && (
                      <p className="text-xs text-green-700 mt-1 font-medium">
                        ✅ Coordenadas ajustadas manualmente
                      </p>
                    )}
                </div>
              ) : (
                <p className="text-xs text-yellow-700 mt-2">
                  ⚠️ No hay coordenadas GPS - Usa el buscador
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Map Display */}
      {hasCoordinates || suggestedAddress?.latitude ? (
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
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                {hasCoordinates && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                    <span className="text-gray-700">Actual</span>
                  </div>
                )}
                {suggestedAddress?.latitude && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-gray-700">Sugerido</span>
                  </div>
                )}
              </div>
              <span className="text-gray-600">
                {!showingComparison && "Arrastra el marcador para ajustar"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg bg-gray-50 p-8">
          <div className="text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-700 mb-1">Mapa no disponible</p>
            <p className="text-sm">Sin coordenadas GPS.</p>
            <p className="text-xs mt-2">Usa el buscador para encontrar la ubicación.</p>
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
              <p className="text-sm text-green-700">Verificada correctamente. Puedes continuar.</p>
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
                Verifica que la dirección y ubicación sean correctas antes de continuar.
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
            {hasCoordinates ? "Ver en Google Maps (exacto)" : "Buscar en Google Maps"}
          </a>
        </div>
      )}
    </div>
  );
}
