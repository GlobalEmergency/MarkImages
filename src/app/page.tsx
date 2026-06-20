"use client";

import {
  AlertCircle,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Clock,
  X,
  ChevronDown,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getTranslation } from "@/lib/i18n";

import AedDetailModal from "@/components/AedDetailModal";
import {
  AppDownloadPrompt,
  AppDownloadSection,
  AppSmartBanner,
  useAppDownloadPrompt,
} from "@/components/AppDownloadBanner";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { Aed } from "@/types/aed";

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-600 mb-4" />
        <p className="text-gray-700 font-medium">{getTranslation("home.loading_map")}</p>
      </div>
    </div>
  ),
});

interface NearbyAed extends Aed {
  distance: number;
}

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
  };
}

export default function Home() {
  const t = getTranslation;
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbyAeds, setNearbyAeds] = useState<NearbyAed[]>([]);
  const [selectedAed, setSelectedAed] = useState<Aed | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const {
    trackSearch,
    trackSearchSuggestionClick,
    trackGeolocationRequest,
    trackSearchClear,
    trackDeaCardClick,
    trackDeaModalOpen,
    trackDeaModalClose,
    trackMarkerClick,
    trackExternalLink,
    trackNavClick,
    trackResultsPanelToggle,
    trackButtonClick,
  } = useAnalytics();

  const appPrompt = useAppDownloadPrompt();

  // Debounce for address search
  const searchAddressSuggestions = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data: GeocodingResult[] = await response.json();
        setAddressSuggestions(data.slice(0, 5)); // Limit to 5 suggestions
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Debounce effect for address search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (address.length >= 3) {
        searchAddressSuggestions(address);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [address]);

  // Centralized function to search nearby AEDs
  const searchNearbyAeds = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    setNearbyAeds([]);
    setShowResults(true);

    try {
      const nearbyResponse = await fetch(
        `/api/aeds/nearby?lat=${lat}&lng=${lng}&limit=10&radius=10`
      );

      if (!nearbyResponse.ok) {
        throw new Error(t("common.error_searching"));
      }

      const nearbyData = await nearbyResponse.json();

      if (nearbyData.success && nearbyData.data) {
        setNearbyAeds(nearbyData.data);
        if (nearbyData.data.length === 0) {
          setError(t("home.error_no_results"));
        } else {
          appPrompt.trigger("search_results", 2000);
        }
      } else {
        throw new Error(nearbyData.message || t("common.error_searching"));
      }
    } catch (err) {
      console.error("Error searching nearby:", err);
      setError(err instanceof Error ? err.message : t("common.error_searching"));
    } finally {
      setLoading(false);
    }
  };

  // Handle when user drags the search location marker
  const handleSearchLocationChange = (location: { lat: number; lng: number }) => {
    setSearchLocation(location);
    searchNearbyAeds(location.lat, location.lng);
  };

  // Handle address change from reverse geocoding
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
  };

  const handleSuggestionClick = async (suggestion: GeocodingResult, index: number) => {
    trackSearchSuggestionClick(index, suggestion.display_name);
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    setAddressSuggestions([]);

    // Immediately search for DEAs at this location
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setSearchLocation({ lat, lng });
    await searchNearbyAeds(lat, lng);
  };

  const handleFindNearestByGeolocation = async () => {
    trackSearch("geolocation");
    setLoading(true);
    setError(null);
    setNearbyAeds([]);
    setShowResults(true);

    try {
      // Get user's location
      if (!navigator.geolocation) {
        throw new Error(t("home.error_geolocation_unavailable"));
      }

      const position = await new Promise<{
        coords: { latitude: number; longitude: number };
      }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      trackGeolocationRequest("success");
      appPrompt.trigger("geolocation", 3000);
      const { latitude, longitude } = position.coords;
      setSearchLocation({ lat: latitude, lng: longitude });

      // Use centralized search function
      await searchNearbyAeds(latitude, longitude);
    } catch (err) {
      console.error("Error finding nearest AEDs:", err);
      // Check if it's a GeolocationPositionError by checking for code property
      if (typeof err === "object" && err !== null && "code" in err) {
        const geoError = err as {
          code: number;
          PERMISSION_DENIED: number;
          POSITION_UNAVAILABLE: number;
        };
        if (geoError.code === 1) {
          // PERMISSION_DENIED
          trackGeolocationRequest("denied");
          setError(t("home.error_geolocation_denied"));
        } else if (geoError.code === 2) {
          // POSITION_UNAVAILABLE
          trackGeolocationRequest("error");
          setError(t("home.error_geolocation_error"));
        } else {
          trackGeolocationRequest("error");
          setError(t("home.error_geolocation_timeout"));
        }
      } else {
        trackGeolocationRequest("error");
        setError(err instanceof Error ? err.message : t("common.error_searching"));
      }
      setLoading(false);
    }
  };

  const handleSearchByAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address.trim()) {
      setError(t("home.error_empty_address"));
      return;
    }

    trackSearch("address", address);
    setLoading(true);
    setError(null);
    setNearbyAeds([]);
    setShowResults(true);

    try {
      // Geocode the address
      const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);

      if (!geocodeResponse.ok) {
        throw new Error(t("home.error_geocode"));
      }

      const geocodeData: GeocodingResult[] = await geocodeResponse.json();

      if (!geocodeData || geocodeData.length === 0) {
        throw new Error(t("home.error_address_not_found"));
      }

      // Use the first result
      const location = geocodeData[0];
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lon);

      setSearchLocation({ lat, lng });

      // Use centralized search function
      await searchNearbyAeds(lat, lng);
    } catch (err) {
      console.error("Error searching by address:", err);
      setError(err instanceof Error ? err.message : t("home.error_geocode"));
      setLoading(false);
    }
  };

  const handleCardClick = (aed: NearbyAed, position: number) => {
    trackDeaCardClick(aed.id, aed.name, position);
    trackDeaModalOpen(aed.id, aed.name);
    setSelectedAed(aed);
    setModalOpen(true);
  };

  const handleCloseModal = (closeMethod: "button" | "backdrop" | "escape" = "button") => {
    if (selectedAed) {
      trackDeaModalClose(selectedAed.id, closeMethod);
    }
    setModalOpen(false);
    setTimeout(() => setSelectedAed(null), 200);
  };

  const handleClearSearch = () => {
    trackSearchClear();
    trackResultsPanelToggle(false);
    setShowResults(false);
    setNearbyAeds([]);
    setSearchLocation(null);
    setError(null);
    setAddress("");
  };

  const handleMapMarkerClick = async (aed: { id: string; code: string; name: string }) => {
    trackMarkerClick(aed.id, aed.name);
    try {
      const response = await fetch(`/api/aeds/${aed.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          trackDeaModalOpen(aed.id, aed.name);
          setSelectedAed(data.data);
          setModalOpen(true);
        }
      }
    } catch (error) {
      console.error("Error fetching AED details:", error);
    }
  };

  return (
    <>
      {/* Smart App Banner for mobile users */}
      <AppSmartBanner />

      {/* Contextual App Download Prompt */}
      <AppDownloadPrompt
        visible={appPrompt.visible}
        context={appPrompt.context}
        platform={appPrompt.platform}
        onDismiss={appPrompt.dismiss}
      />

      {/* Fullscreen Map Section */}
      <div className="relative w-full h-[calc(100vh-56px)]">
        <h1 className="sr-only">{t("home.sr_title")}</h1>
        <MapView
          onAedClick={handleMapMarkerClick}
          searchLocation={searchLocation}
          onSearchLocationChange={handleSearchLocationChange}
          onAddressChange={handleAddressChange}
        />

        {/* Search Controls Overlay - Desktop: Top Left, Mobile: Top (hidden when modal open) */}
        <div
          className={`absolute top-4 left-4 right-4 z-[1000] pointer-events-none ${modalOpen ? "hidden" : ""}`}
        >
          <div className="max-w-md pointer-events-auto">
            {/* Search Box */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
              <form onSubmit={handleSearchByAddress} className="flex items-center gap-2 p-3">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t("home.search_placeholder")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  disabled={loading}
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm disabled:opacity-50"
                  autoComplete="off"
                />
                {loadingSuggestions && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {address && !loadingSuggestions && (
                  <button
                    type="button"
                    onClick={() => {
                      trackButtonClick("clear_address", "search_box");
                      setAddress("");
                      setShowSuggestions(false);
                      setAddressSuggestions([]);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </form>

              {/* Address Suggestions Dropdown */}
              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                  {addressSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion, index)}
                      className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{suggestion.display_name}</p>
                        {suggestion.address.city && (
                          <p className="text-xs text-gray-500 mt-0.5">{suggestion.address.city}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Geolocation Button - Visible on Desktop */}
              <div className="hidden md:block border-t border-gray-200">
                <button
                  onClick={handleFindNearestByGeolocation}
                  disabled={loading}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">
                        {t("common.searching")}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Navigation className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {t("common.use_my_location")}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 shadow-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Geolocation Button - Mobile: Bottom Center (hidden when modal open) */}
        <div
          className={`md:hidden absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[1000] ${modalOpen ? "hidden" : ""}`}
        >
          <button
            onClick={handleFindNearestByGeolocation}
            disabled={loading}
            className="bg-blue-600 text-white rounded-full shadow-2xl p-4 flex items-center gap-3 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm font-medium pr-2">{t("common.searching")}</span>
              </>
            ) : (
              <>
                <Navigation className="w-6 h-6" />
                <span className="text-sm font-medium pr-2">{t("common.use_my_location")}</span>
              </>
            )}
          </button>
        </div>

        {/* Results Panel - Right Side on Desktop, Bottom Sheet on Mobile */}
        {showResults && nearbyAeds.length > 0 && (
          <>
            {/* Desktop: Right Panel */}
            <div className="hidden md:block absolute top-4 right-4 bottom-4 w-96 z-[1000]">
              <div className="bg-white rounded-xl shadow-2xl h-full flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
                  <div className="text-white">
                    <h3 className="font-bold text-lg">
                      {t(
                        nearbyAeds.length === 1
                          ? "home.results_count_one"
                          : "home.results_count_other",
                        {
                          count: nearbyAeds.length,
                        }
                      )}
                    </h3>
                    <p className="text-sm text-blue-100">{t("home.sorted_by_distance")}</p>
                  </div>
                  <button
                    onClick={handleClearSearch}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {nearbyAeds.map((aed, index) => (
                    <NearbyAedCard
                      key={aed.id}
                      aed={aed}
                      rank={index + 1}
                      onClick={() => handleCardClick(aed, index + 1)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: Bottom Sheet */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 z-[1000] max-h-[50vh]">
              <div className="bg-white rounded-t-2xl shadow-2xl overflow-hidden">
                {/* Handle */}
                <div className="p-2 flex justify-center">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-4 pb-3 flex items-center justify-between border-b border-gray-200">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {t(
                        nearbyAeds.length === 1
                          ? "home.results_count_one"
                          : "home.results_count_other",
                        {
                          count: nearbyAeds.length,
                        }
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">{t("home.sorted_by_distance")}</p>
                  </div>
                  <button
                    onClick={handleClearSearch}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Results List */}
                <div className="overflow-y-auto max-h-[40vh] p-4 space-y-3">
                  {nearbyAeds.map((aed, index) => (
                    <NearbyAedCard
                      key={aed.id}
                      aed={aed}
                      rank={index + 1}
                      onClick={() => handleCardClick(aed, index + 1)}
                      compact
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Scroll Down Indicator - Hide when showing results or modal open */}
        {!showResults && !modalOpen && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[999] pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-white drop-shadow-lg">
              <span className="text-sm font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                {t("common.more_info")}
              </span>
              <ChevronDown className="w-6 h-6 animate-bounce" />
            </div>
          </div>
        )}

        {/* Detail Modal */}
        <AedDetailModal
          aed={selectedAed}
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onDirectionsClick={() => appPrompt.trigger("directions")}
          onViewDuration={() => appPrompt.trigger("dea_detail")}
        />
      </div>

      {/* Info Section - After the map */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-16 space-y-16">
          {/* About Section */}
          <section className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">{t("home.about.title")}</h2>
              <p className="text-xl text-gray-600">{t("home.about.subtitle")}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t("home.about.what_is_title")}
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">{t("home.about.what_is_text")}</p>
                <p className="text-sm text-gray-600">
                  {t("home.about.developed_by")}{" "}
                  <a
                    href="https://www.globalemergency.online/proyectos/deamap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-semibold underline decoration-1 underline-offset-2"
                    onClick={() =>
                      trackExternalLink(
                        "https://www.globalemergency.online/proyectos/deamap",
                        "Global Emergency",
                        "about_section"
                      )
                    }
                  >
                    Global Emergency
                  </a>
                  {t("home.about.organization_desc")}
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t("home.about.how_it_works_title")}
                </h3>
                <p className="text-gray-700 leading-relaxed">{t("home.about.how_it_works_text")}</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t("home.about.why_important_title")}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {t("home.about.why_important_text")}
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t("home.about.collaborate_title")}
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  {t("home.about.collaborate_text")}
                </p>
                <Link
                  href="/dea/new"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => trackNavClick(t("home.about.add_dea_button"), "/dea/new")}
                >
                  <MapPin className="w-4 h-4" />
                  {t("home.about.add_dea_button")}
                </Link>
              </div>
            </div>
          </section>

          {/* App Download Banner */}
          <AppDownloadSection />

          {/* Stats Section */}
          <section className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 shadow-2xl text-white">
              <h2 className="text-3xl font-bold mb-8 text-center">{t("home.coverage.title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <MapPin className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-4xl font-bold mb-2">🇪🇸</p>
                  <p className="text-lg font-semibold">{t("home.coverage.spain")}</p>
                  <p className="text-sm text-blue-100 mt-1">
                    {t("home.coverage.national_coverage")}
                  </p>
                </div>
                <div className="text-center">
                  <Heart className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-4xl font-bold mb-2">24/7</p>
                  <p className="text-lg font-semibold">{t("home.coverage.available")}</p>
                  <p className="text-sm text-blue-100 mt-1">
                    {t("home.coverage.permanent_access")}
                  </p>
                </div>
                <div className="text-center">
                  <Navigation className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-4xl font-bold mb-2">🇪🇺</p>
                  <p className="text-lg font-semibold">{t("home.coverage.europe")}</p>
                  <p className="text-sm text-blue-100 mt-1">{t("home.coverage.coming_soon")}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * Nearby AED Card Component
 */
function NearbyAedCard({
  aed,
  rank,
  onClick,
  compact = false,
}: {
  aed: NearbyAed;
  rank: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const displayImage =
    aed.images && aed.images.length > 0
      ? aed.images[0].thumbnail_url || aed.images[0].processed_url || aed.images[0].original_url
      : null;

  const distanceText =
    aed.distance < 1
      ? `${Math.round(aed.distance * 1000)} ${getTranslation("common.meters_short")}`
      : `${aed.distance.toFixed(1)} ${getTranslation("common.kilometers_short")}`;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
      >
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{
              background:
                rank === 1
                  ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                  : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            }}
          >
            {rank}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-blue-600 text-sm">{distanceText}</span>
            </div>
            <h4 className="font-semibold text-gray-900 text-sm mb-1 truncate">{aed.name}</h4>
            <p className="text-xs text-gray-600 truncate">
              {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all text-left"
    >
      {/* Image or Gradient */}
      {displayImage ? (
        <div className="relative h-32">
          <img src={displayImage} alt={aed.name} className="w-full h-full object-cover" />
          <div
            className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg"
            style={{
              background:
                rank === 1
                  ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                  : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            }}
          >
            {rank}
          </div>
        </div>
      ) : (
        <div
          className="h-32 relative"
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
          }}
        >
          <div
            className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg"
            style={{
              background:
                rank === 1
                  ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                  : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            }}
          >
            {rank}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Distance */}
        <div
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-bold"
          style={{
            background:
              rank === 1
                ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
          }}
        >
          <Navigation className="w-3 h-3" />
          {distanceText}
        </div>

        {/* Name */}
        <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{aed.name}</h4>

        {/* Location */}
        <div className="flex items-start gap-1 text-xs text-gray-600">
          <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-500" />
          <p className="line-clamp-2">
            {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
          </p>
        </div>

        {/* Schedule */}
        {aed.schedule && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3 flex-shrink-0 text-green-500" />
            <p>
              {aed.schedule.has_24h_surveillance
                ? "24h"
                : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                  ? `L-V: ${aed.schedule.weekday_opening}-${aed.schedule.weekday_closing}${aed.schedule.saturday_opening && aed.schedule.saturday_closing ? ` · S: ${aed.schedule.saturday_opening}-${aed.schedule.saturday_closing}` : ""}${aed.schedule.sunday_opening && aed.schedule.sunday_closing ? ` · D: ${aed.schedule.sunday_opening}-${aed.schedule.sunday_closing}` : ""}`
                  : "Horario no especificado"}
            </p>
          </div>
        )}

        {/* Contact */}
        {aed.responsible && aed.responsible.phone && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Phone className="w-3 h-3 flex-shrink-0 text-blue-500" />
            <p>{aed.responsible.phone}</p>
          </div>
        )}
      </div>
    </button>
  );
}
