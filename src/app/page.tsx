"use client";

import {
  Clock,
  Heart,
  Image as ImageIcon,
  List,
  Map,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import AedDetailModal from "@/components/AedDetailModal";
import { useAeds } from "@/hooks/useAeds";
import type { Aed } from "@/types/aed";

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-xl bg-white/95 flex items-center justify-center">
      <div className="text-center">
        <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-600 mb-4" />
        <p className="text-gray-700 font-medium">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedAed, setSelectedAed] = useState<Aed | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const { aeds, loading, error, pagination, refetch } = useAeds({
    page,
    limit: 50,
    search,
  });

  const handleCardClick = (aed: Aed) => {
    setSelectedAed(aed);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedAed(null), 200);
  };

  if (loading && aeds.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        }}
      >
        <div
          className="text-center p-8 rounded-2xl shadow-xl"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-600 mb-4" />
          <p className="text-gray-700 font-medium">Cargando DEAs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        }}
      >
        <div
          className="text-center p-8 rounded-2xl shadow-xl"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <p className="text-red-600 mb-4 font-medium">{error}</p>
          <button
            onClick={refetch}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
            style={{ minHeight: "44px" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Hero Header */}
      <header className="text-center text-white px-4 sm:px-6 pt-6 pb-4 sm:pt-8 sm:pb-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
          <div
            className="p-3 sm:p-4 rounded-full flex-shrink-0"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(20px)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <MapPin className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
          </div>
          <div className="text-center sm:text-left">
            <h1
              className="font-black text-3xl sm:text-4xl md:text-5xl mb-1"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                lineHeight: "1.1",
              }}
            >
              deamap.es
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 opacity-90 text-sm sm:text-base">
              <Heart className="w-4 h-4 text-red-300" />
              <span>Mapa de Desfibriladores</span>
              <Navigation className="w-4 h-4" />
            </div>
          </div>
        </div>
        <p className="opacity-90 text-sm sm:text-base max-w-2xl mx-auto px-2">
          {pagination.total} DEAs disponibles en Madrid
        </p>
      </header>

      {/* Search Bar and View Toggle */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4">
        <div
          className="rounded-xl shadow-lg p-4 sm:p-5"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ minHeight: "48px" }}
              />
            </div>

            {/* Add DEA Button */}
            <Link href="/dea/new">
              <button
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 whitespace-nowrap"
                style={{ minHeight: "48px" }}
              >
                <Plus className="w-5 h-5" />
                <span>Agregar DEA</span>
              </button>
            </Link>

            {/* View Toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{
                background: "rgba(0, 0, 0, 0.05)",
              }}
            >
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all ${
                  viewMode === "list"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-white/50"
                }`}
                style={{ minHeight: "48px" }}
              >
                <List className="w-5 h-5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all ${
                  viewMode === "map"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-white/50"
                }`}
                style={{ minHeight: "48px" }}
              >
                <Map className="w-5 h-5" />
                <span className="hidden sm:inline">Mapa</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 pb-12">
        {viewMode === "map" ? (
          <MapView aeds={aeds} onAedClick={handleCardClick} />
        ) : (
          <>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {aeds.map((aed) => (
                <AedCard key={aed.id} aed={aed} onClick={() => handleCardClick(aed)} />
              ))}
            </div>

            {aeds.length === 0 && (
              <div
                className="text-center py-12 sm:py-16 rounded-xl shadow-lg"
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <p className="text-gray-600 text-lg px-4">No se encontraron DEAs</p>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <div
                  className="flex gap-2 sm:gap-3"
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(20px)",
                    padding: "0.5rem",
                    borderRadius: "0.75rem",
                  }}
                >
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all active:scale-95 font-medium"
                    style={{ minHeight: "44px" }}
                  >
                    Anterior
                  </button>
                  <span className="px-4 py-2 flex items-center text-gray-700 font-medium">
                    Página {page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all active:scale-95 font-medium"
                    style={{ minHeight: "44px" }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail Modal */}
      <AedDetailModal aed={selectedAed} isOpen={modalOpen} onClose={handleCloseModal} />
    </div>
  );
}

/**
 * AED Card Component
 */
function AedCard({ aed, onClick }: { aed: Aed; onClick: () => void }) {
  const displayImage =
    aed.images && aed.images.length > 0
      ? aed.images[0].thumbnail_url || aed.images[0].processed_url || aed.images[0].original_url
      : null;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer text-left"
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
      }}
    >
      {/* Image Header or Gradient Header */}
      {displayImage ? (
        <div className="relative h-48 sm:h-56 overflow-hidden">
          <img
            src={displayImage}
            alt={aed.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-base sm:text-lg font-bold text-white truncate">{aed.name}</h3>
            <p className="text-xs sm:text-sm text-white/90 mt-1">{aed.code}</p>
          </div>
          <div
            className="absolute top-3 right-3 p-2 rounded-lg"
            style={{
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Heart className="w-5 h-5 text-red-500" />
          </div>
          {aed.images && aed.images.length > 1 && (
            <div
              className="absolute top-3 left-3 px-2 py-1 rounded-lg text-white text-xs font-medium flex items-center gap-1"
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(10px)",
              }}
            >
              <ImageIcon className="w-3 h-3" />
              {aed.images.length}
            </div>
          )}
        </div>
      ) : (
        <div
          className="p-4 sm:p-5"
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{aed.name}</h3>
              <p className="text-xs sm:text-sm text-white/80 mt-1">{aed.code}</p>
            </div>
            <div
              className="p-2 rounded-lg ml-2 flex-shrink-0"
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Heart className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Type Badge */}
        <div>
          <span className="inline-block px-3 py-1.5 bg-blue-100 text-blue-800 text-xs sm:text-sm rounded-full font-medium">
            {aed.establishment_type}
          </span>
        </div>

        {/* Location */}
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0 text-blue-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base text-gray-900 font-medium break-words">
                {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {aed.location.postal_code} - {aed.location.district.name}
              </p>
            </div>
          </div>

          {/* Schedule */}
          {aed.schedule && (
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-purple-500" />
              <p className="text-sm sm:text-base">
                {aed.schedule.has_24h_surveillance
                  ? "24h Vigilancia"
                  : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                    ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                    : "Horario no especificado"}
              </p>
            </div>
          )}

          {/* Contact */}
          {aed.responsible.phone && (
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-green-500" />
              <p className="text-sm sm:text-base">{aed.responsible.phone}</p>
            </div>
          )}
        </div>

        {/* Coordinates */}
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            📍 {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
          </p>
        </div>
      </div>
    </button>
  );
}
