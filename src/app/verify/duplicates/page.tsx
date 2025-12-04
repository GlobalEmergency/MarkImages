"use client";

import { AlertTriangle, CheckCircle, Filter, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

interface DuplicateAed {
  id: string;
  name: string;
  code: string | null;
  provisional_number: number | null;
  establishment_type: string | null;
  latitude: number | null;
  longitude: number | null;
  attention_reason: string | null;
  status: string;
  location: {
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
    postal_code: string | null;
    district_name: string | null;
    neighborhood_name: string | null;
    specific_location: string | null;
    floor: string | null;
  } | null;
  images: Array<{
    id: string;
    original_url: string;
    type: string | null;
  }>;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiResponse {
  data: DuplicateAed[];
  pagination: PaginationInfo;
}

export default function DuplicatesPage() {
  const { user, loading: authLoading } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicateAed[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify/duplicates");
      return;
    }

    if (user) {
      fetchDuplicates();
    }
  }, [authLoading, user, router]);

  const fetchDuplicates = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/verify/duplicates?page=${page}&limit=20`);

      if (!response.ok) {
        throw new Error("Error al cargar posibles duplicados");
      }

      const data: ApiResponse = await response.json();
      setDuplicates(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const extractScoreFromReason = (reason: string | null): number | null => {
    if (!reason) return null;
    const match = reason.match(/score:\s*(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const extractCandidateInfo = (reason: string | null) => {
    if (!reason) return { name: null, address: null };
    const nameMatch = reason.match(/Similar a "([^"]+)"/);
    const addressMatch = reason.match(/en "([^"]+)"/);
    return {
      name: nameMatch?.[1] || null,
      address: addressMatch?.[1] || null,
    };
  };

  const getScoreBadgeColor = (score: number | null) => {
    if (!score) return "bg-gray-100 text-gray-800";
    if (score >= 80) return "bg-red-100 text-red-800";
    if (score >= 70) return "bg-orange-100 text-orange-800";
    return "bg-yellow-100 text-yellow-800";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando posibles duplicados...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Revisión de Posibles Duplicados
              </h1>
              <p className="text-gray-600">
                DEAs marcados como posibles duplicados durante la importación
              </p>
            </div>
            <button
              onClick={() => router.push("/verify")}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Volver a Verificación
            </button>
          </div>

          {/* Stats */}
          {pagination && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Posibles Duplicados</p>
                    <p className="text-3xl font-bold text-gray-900">{pagination.totalRecords}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-yellow-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Mostrando</p>
                    <p className="text-3xl font-bold text-gray-900">{duplicates.length}</p>
                  </div>
                  <Filter className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Página</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {pagination.currentPage} / {pagination.totalPages}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-700">📄</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Filtros</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distrito</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los distritos</option>
                    {/* TODO: Add districts */}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Score Mínimo
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos</option>
                    <option value="60">60+</option>
                    <option value="70">70+</option>
                    <option value="80">80+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Establecimiento
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los tipos</option>
                    {/* TODO: Add establishment types */}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <XCircle className="w-5 h-5" />
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {duplicates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              ¡No hay posibles duplicados!
            </h3>
            <p className="text-gray-600">Todos los DEAs están en buen estado</p>
          </div>
        ) : (
          <>
            {/* Duplicates List */}
            <div className="space-y-4 mb-8">
              {duplicates.map((dup) => {
                const score = extractScoreFromReason(dup.attention_reason);
                const candidate = extractCandidateInfo(dup.attention_reason);
                const firstImage = dup.images[0];

                return (
                  <div
                    key={dup.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Image */}
                        {firstImage && (
                          <div className="w-full md:w-48 h-48 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={firstImage.original_url}
                              alt={dup.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                                {dup.name}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {dup.code ||
                                  (dup.provisional_number
                                    ? `#${dup.provisional_number}`
                                    : "Sin código")}
                              </p>
                            </div>
                            {score && (
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreBadgeColor(score)}`}
                              >
                                Score: {score}/100
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 mb-4">
                            {dup.establishment_type && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Tipo:</span> {dup.establishment_type}
                              </p>
                            )}
                            {dup.location && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Dirección:</span>{" "}
                                {dup.location.street_type} {dup.location.street_name}{" "}
                                {dup.location.street_number}
                                {dup.location.district_name && ` - ${dup.location.district_name}`}
                              </p>
                            )}
                            {candidate.name && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                                <p className="text-sm font-medium text-yellow-900 mb-1">
                                  Similar a:
                                </p>
                                <p className="text-sm text-yellow-800">
                                  <span className="font-semibold">{candidate.name}</span>
                                  {candidate.address && ` en ${candidate.address}`}
                                </p>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => router.push(`/verify/duplicates/${dup.id}`)}
                            className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Revisar Comparación
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => fetchDuplicates(pagination.currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors"
                >
                  ← Anterior
                </button>

                <div className="flex items-center px-4 py-2 bg-white rounded-lg shadow-sm">
                  <span className="text-gray-700">
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                </div>

                <button
                  onClick={() => fetchDuplicates(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
