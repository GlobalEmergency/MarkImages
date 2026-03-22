"use client";

import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Settings,
  AlertCircle,
  Phone,
  Navigation,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Aed } from "@/types/aed";

export default function DeaDetailClient() {
  const params = useParams();
  const router = useRouter();
  const [aed, setAed] = useState<Aed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchAed = async () => {
      try {
        const response = await fetch(`/api/aeds/${params.id}`);
        if (!response.ok) throw new Error("Failed to fetch AED");
        const data = await response.json();
        setAed(data.success ? data.data : data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchAed();
    }
  }, [params.id]);

  const handleCallEmergency = () => {
    window.location.href = "tel:112";
  };

  const handleGetDirections = () => {
    if (aed) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${aed.latitude},${aed.longitude}`,
        "_blank"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-500 mb-4" />
          <p className="text-white">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !aed) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
          <p className="text-gray-300">No se pudo cargar la información del DEA.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const address = `${aed.location.street_type} ${aed.location.street_name}, ${aed.location.street_number || ""}`;
  const is24h = aed.schedule?.has_24h_surveillance || false;
  const verifiedImages = aed.images || [];
  const hasImages = verifiedImages.length > 0;
  const currentImage = hasImages ? verifiedImages[currentImageIndex] : null;
  const currentImageUrl = currentImage?.processed_url || currentImage?.original_url || null;

  // Image type labels in Spanish
  const imageTypeLabels: Record<string, string> = {
    FRONT: "Vista frontal",
    LOCATION: "Ubicación",
    ACCESS: "Acceso",
    SIGNAGE: "Señalización",
    CONTEXT: "Contexto",
    PLATE: "Placa",
  };

  // Navigate to next image
  const handleNextImage = () => {
    if (hasImages) {
      setCurrentImageIndex((prev) => (prev + 1) % verifiedImages.length);
    }
  };

  // Navigate to previous image
  const handlePrevImage = () => {
    if (hasImages) {
      setCurrentImageIndex((prev) => (prev - 1 + verifiedImages.length) % verifiedImages.length);
    }
  };

  // Handle keyboard navigation in lightbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") handleNextImage();
    if (e.key === "ArrowLeft") handlePrevImage();
    if (e.key === "Escape") setShowLightbox(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      {/* Header */}
      <header className="relative">
        {/* Hero Image Gallery */}
        <div className="relative w-full aspect-square max-h-80 md:max-h-96 bg-gradient-to-b from-gray-800 to-gray-700 flex items-center justify-center">
          {currentImageUrl ? (
            <>
              <img
                src={currentImageUrl}
                alt={`${aed.name} - ${currentImage ? imageTypeLabels[currentImage.type] || currentImage.type : ""}`}
                className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowLightbox(true)}
              />

              {/* Image Type Badge */}
              {currentImage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-medium">
                  {imageTypeLabels[currentImage.type] || currentImage.type}
                </div>
              )}

              {/* Navigation Arrows - Only show if multiple images */}
              {verifiedImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-all z-10"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-all z-10"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Counter & Zoom Hint */}
              <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                {verifiedImages.length > 1 && (
                  <span className="font-medium">
                    {currentImageIndex + 1} / {verifiedImages.length}
                  </span>
                )}
                <span className="text-xl">🔍</span>
                <span className="hidden sm:inline">Click para ampliar</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-20 h-20 text-gray-600" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Thumbnails Gallery - Only show if multiple images */}
        {verifiedImages.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {verifiedImages.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentImageIndex
                      ? "border-teal-500 ring-2 ring-teal-500/50"
                      : "border-gray-600 hover:border-gray-400"
                  }`}
                  aria-label={`Ver ${imageTypeLabels[image.type] || image.type}`}
                >
                  <img
                    src={image.processed_url || image.original_url}
                    alt={imageTypeLabels[image.type] || image.type}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 bg-gray-900 bg-opacity-80 text-white rounded-full p-2 hover:bg-opacity-100 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Logo */}
        <div className="absolute top-4 right-4">
          <span className="text-white text-lg font-bold">deamap.es</span>
        </div>
      </header>

      {/* Enhanced Lightbox Modal with Navigation */}
      {showLightbox && currentImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 transition-all z-10"
            aria-label="Cerrar lightbox"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image Counter */}
          {verifiedImages.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-3 rounded-lg z-10">
              <span className="font-medium">
                {currentImageIndex + 1} / {verifiedImages.length}
              </span>
              <span className="text-sm text-gray-300 ml-2">
                {currentImage ? imageTypeLabels[currentImage.type] || currentImage.type : ""}
              </span>
            </div>
          )}

          {/* Navigation Arrows */}
          {verifiedImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 transition-all z-10"
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 transition-all z-10"
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Main Image */}
          <img
            src={currentImageUrl}
            alt={`${aed.name} - ${currentImage ? imageTypeLabels[currentImage.type] || currentImage.type : ""}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Keyboard Hints */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm hidden md:block">
            <span className="text-gray-300">
              Usa las flechas ← → para navegar • ESC para cerrar
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 -mt-8 relative z-10">
        {/* Status Badge */}
        {is24h && (
          <div className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg mb-4">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium text-sm">DISPONIBLE 24H</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold mb-6">{aed.name}</h1>

        {/* Location Section */}
        <section className="bg-gray-800 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-4">Ubicación</h2>

          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-teal-500 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium">{address}</p>
              <p className="text-gray-400 text-sm">{aed.location.postal_code} Madrid</p>
              <p className="text-gray-500 text-xs mt-1">{aed.location.district_name}</p>
              <p className="text-gray-500 text-xs mt-2">
                📍 {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <button
            onClick={handleGetDirections}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Ver en el mapa
          </button>
        </section>

        {/* Details Section */}
        <section className="bg-gray-800 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-4">Detalles</h2>

          {/* Schedule */}
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-700">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              {is24h ? (
                <>
                  <p className="text-white font-medium">Lunes a Domingo: 24 horas</p>
                  <p className="text-gray-400 text-sm">Disponible las 24 horas</p>
                </>
              ) : aed.schedule?.weekday_opening && aed.schedule?.weekday_closing ? (
                <div className="space-y-1">
                  <p className="text-white font-medium">
                    L-V: {aed.schedule.weekday_opening} - {aed.schedule.weekday_closing}
                  </p>
                  {aed.schedule.saturday_opening && aed.schedule.saturday_closing && (
                    <p className="text-gray-300 text-sm">
                      Sáb: {aed.schedule.saturday_opening} - {aed.schedule.saturday_closing}
                    </p>
                  )}
                  {aed.schedule.sunday_opening && aed.schedule.sunday_closing && (
                    <p className="text-gray-300 text-sm">
                      Dom: {aed.schedule.sunday_opening} - {aed.schedule.sunday_closing}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-white font-medium">Horario no especificado</p>
                  <p className="text-gray-400 text-sm">Horario de servicio</p>
                </>
              )}
            </div>
          </div>

          {/* Access */}
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-700">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Acceso Público</p>
              <p className="text-gray-400 text-sm">
                {aed.location.access_instructions || "No requiere solicitar al personal"}
              </p>
            </div>
          </div>

          {/* Last verification */}
          <div className="flex items-start gap-3">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">
                Última revisión:{" "}
                {aed.published_at
                  ? new Date(aed.published_at).toLocaleDateString("es-ES")
                  : "No disponible"}
              </p>
              <p className="text-gray-400 text-sm">Estado verificado por la comunidad</p>
            </div>
          </div>
        </section>

        {/* Contact Info - Only show if responsible exists */}
        {aed.responsible && (
          <section className="bg-gray-800 rounded-2xl p-5 mb-4">
            <h2 className="text-lg font-semibold mb-4">Contacto</h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Responsable</p>
                <p className="text-white font-medium">{aed.responsible.name}</p>
              </div>

              {aed.responsible.phone && (
                <div>
                  <p className="text-gray-400">Teléfono</p>
                  <a
                    href={`tel:${aed.responsible.phone}`}
                    className="text-blue-400 hover:underline"
                  >
                    {aed.responsible.phone}
                  </a>
                </div>
              )}

              <div>
                <p className="text-gray-400">Email</p>
                <a
                  href={`mailto:${aed.responsible.email}`}
                  className="text-blue-400 hover:underline"
                >
                  {aed.responsible.email}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Report Problem Button */}
        <button className="w-full bg-transparent border border-red-500 text-red-500 py-3 rounded-lg font-medium hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2 mb-20">
          <AlertCircle className="w-5 h-5" />
          Reportar un problema
        </button>
      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-50">
        <div className="max-w-7xl mx-auto flex gap-3">
          <button
            onClick={handleGetDirections}
            className="flex-1 bg-teal-500 text-white py-4 rounded-xl font-medium hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Cómo llegar
          </button>
          <button
            onClick={handleCallEmergency}
            className="flex-1 bg-red-500 text-white py-4 rounded-xl font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Llamar al 112
          </button>
        </div>
      </div>
    </div>
  );
}
