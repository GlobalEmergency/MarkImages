"use client";

import { Activity, MapPin, Clock, Phone } from "lucide-react";
import { useState } from "react";

import { useAeds } from "@/hooks/useAeds";
import type { Aed } from "@/types/aed";

export default function Home() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { aeds, loading, error, pagination, refetch } = useAeds({
    page,
    limit: 50,
    search,
  });

  if (loading && aeds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto text-red-600 mb-4" />
          <p className="text-gray-600">Cargando DEAs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-red-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">Desfibriladores Madrid</h1>
                <p className="text-red-100">{pagination.total} DEAs registrados</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* AED List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {aeds.map((aed) => (
            <AedCard key={aed.id} aed={aed} />
          ))}
        </div>

        {aeds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No se encontraron DEAs</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-4 py-2">
              Página {page} de {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 bg-white border rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * AED Card Component
 */
function AedCard({ aed }: { aed: Aed }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{aed.name}</h3>
          <p className="text-sm text-gray-500">{aed.code}</p>
        </div>
        <Activity className="w-6 h-6 text-red-600" />
      </div>

      {/* Type */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
          {aed.establishment_type}
        </span>
      </div>

      {/* Location */}
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-start space-x-2">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>
              {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
            </p>
            <p>
              {aed.location.postal_code} - {aed.location.district.name}
            </p>
          </div>
        </div>

        {/* Schedule */}
        {aed.schedule && (
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <p>
              {aed.schedule.has_24h_surveillance
                ? "24h"
                : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                  ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                  : "Horario no especificado"}
            </p>
          </div>
        )}

        {/* Contact */}
        {aed.responsible.phone && (
          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <p>{aed.responsible.phone}</p>
          </div>
        )}
      </div>

      {/* Coordinates */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-400">
        <p>
          Coordenadas: {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
        </p>
      </div>
    </div>
  );
}
