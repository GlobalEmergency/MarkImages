"use client";

import { AlertTriangle, Filter, Loader2, Search, Shield, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import NoOrganizationMessage from "@/components/verification/NoOrganizationMessage";
import OrganizationSelector from "@/components/verification/OrganizationSelector";
import { useAuth } from "@/contexts/AuthContext";

type FilterType = "pending" | "published_unverified" | "published_verified" | "all_published";

interface FilterOption {
  value: FilterType;
  label: string;
  description: string;
  badgeColor: string;
  badgeText: string;
}

interface AedForVerification {
  id: string;
  name: string;
  code?: string;
  provisional_number?: number;
  establishment_type?: string;
  location?: {
    street_type?: string;
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    district_name?: string | null;
    neighborhood_name?: string | null;
    city_name?: string | null;
  };
  images?: Array<{
    id: string;
    original_url: string;
    type: string;
  }>;
  status: string;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UserOrganization {
  id: string;
  name: string;
  type: string;
  role: string;
  can_verify: boolean;
}

interface ApiResponse {
  data: AedForVerification[];
  pagination: PaginationInfo;
  userOrganizations: UserOrganization[];
  isAdmin: boolean;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    value: "pending",
    label: "Pendientes de verificar",
    description: "DEAs en borrador o pendientes de revisión",
    badgeColor: "bg-yellow-100 text-yellow-800",
    badgeText: "Pendiente",
  },
  {
    value: "published_unverified",
    label: "Publicados sin verificar",
    description: "DEAs publicados pero sin verificación manual",
    badgeColor: "bg-orange-100 text-orange-800",
    badgeText: "Sin verificar",
  },
  {
    value: "published_verified",
    label: "Publicados verificados",
    description: "DEAs publicados y verificados manualmente",
    badgeColor: "bg-green-100 text-green-800",
    badgeText: "Verificado",
  },
  {
    value: "all_published",
    label: "Todos los publicados",
    description: "Todos los DEAs publicados",
    badgeColor: "bg-blue-100 text-blue-800",
    badgeText: "Publicado",
  },
];

export default function VerifyPage() {
  const { user, loading: authLoading } = useAuth();
  const [aeds, setAeds] = useState<AedForVerification[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify");
      return;
    }

    if (user) {
      fetchAeds();
    }
  }, [authLoading, user, router]);

  // Refetch when organization, filter or search changes
  useEffect(() => {
    if (user && !loading) {
      fetchAeds(1, selectedOrgId, filterType, searchTerm);
    }
  }, [selectedOrgId, filterType, searchTerm]);

  const fetchAeds = async (
    page: number = 1,
    orgId: string | null = selectedOrgId,
    filter: FilterType = filterType,
    search: string = searchTerm
  ) => {
    try {
      setLoading(page === 1);
      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", "12");
      url.searchParams.set("filter_type", filter);
      if (orgId) {
        url.searchParams.set("organization_id", orgId);
      }
      if (search) {
        url.searchParams.set("search", search);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Error al cargar DEAs");
      }

      const data: ApiResponse = await response.json();
      setAeds(data.data);
      setPagination(data.pagination);
      setUserOrganizations(data.userOrganizations || []);
      setIsAdmin(data.isAdmin || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreAeds = async () => {
    if (!pagination || !pagination.hasNextPage || loadingMore) return;

    try {
      setLoadingMore(true);
      const nextPage = pagination.currentPage + 1;
      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("page", nextPage.toString());
      url.searchParams.set("limit", "12");
      url.searchParams.set("filter_type", filterType);
      if (selectedOrgId) {
        url.searchParams.set("organization_id", selectedOrgId);
      }
      if (searchTerm) {
        url.searchParams.set("search", searchTerm);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Error al cargar más DEAs");
      }

      const data: ApiResponse = await response.json();
      setAeds((prev) => [...prev, ...data.data]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar más DEAs");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOrganizationChange = (orgId: string | null) => {
    setSelectedOrgId(orgId);
    setAeds([]); // Clear current list
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    setAeds([]); // Clear current list
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setAeds([]); // Clear current list
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchTerm("");
    setAeds([]); // Clear current list
  };

  const currentFilter = FILTER_OPTIONS.find((f) => f.value === filterType) || FILTER_OPTIONS[0];

  const startVerification = (aedId: string) => {
    router.push(`/verify/${aedId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show message if user has no organizations and is not admin
  if (!isAdmin && userOrganizations.length === 0 && !loading) {
    return <NoOrganizationMessage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verificación de DEAs</h1>
              <p className="text-gray-600">
                Selecciona un DEA para iniciar el proceso de verificación
              </p>
            </div>
            <button
              onClick={() => router.push("/verify/duplicates")}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors font-medium"
            >
              <AlertTriangle className="w-5 h-5" />
              Ver Posibles Duplicados
            </button>
          </div>

          {/* Admin badge */}
          {isAdmin && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-sm text-purple-600 font-medium">Modo Administrador</div>
                  <div className="text-sm text-purple-700">
                    Visualizando todos los DEAs del sistema
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros</span>
            </div>

            <div className="flex flex-col gap-4">
              {/* Search field */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Buscar DEA</label>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Código, nombre, dirección..."
                      className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Buscar
                  </button>
                </form>
                {searchTerm && (
                  <p className="mt-1 text-xs text-blue-600">Buscando: &quot;{searchTerm}&quot;</p>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                {/* Filter type selector */}
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Estado de verificación
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => handleFilterChange(e.target.value as FilterType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{currentFilter.description}</p>
                </div>

                {/* Organization selector (only for non-admin users) */}
                {!isAdmin && userOrganizations.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Organización
                    </label>
                    <OrganizationSelector
                      organizations={userOrganizations}
                      selectedOrgId={selectedOrgId}
                      onChange={handleOrganizationChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {pagination && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span>
                  Mostrando <strong>{aeds.length}</strong> de{" "}
                  <strong>{pagination.totalRecords}</strong> DEAs (
                  {currentFilter.label.toLowerCase()})
                </span>
                <span className="text-blue-600">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
              </div>

              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${pagination.totalRecords > 0 ? (aeds.length / pagination.totalRecords) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {aeds.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">
              {searchTerm
                ? "🔍"
                : filterType === "pending"
                  ? "✅"
                  : filterType === "published_verified"
                    ? "🎉"
                    : "📋"}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm
                ? "No se encontraron resultados"
                : filterType === "pending"
                  ? "No hay DEAs pendientes de verificar"
                  : filterType === "published_unverified"
                    ? "No hay DEAs publicados sin verificar"
                    : filterType === "published_verified"
                      ? "No hay DEAs verificados"
                      : "No hay DEAs publicados"}
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? `No se encontraron DEAs que coincidan con "${searchTerm}"`
                : filterType === "pending"
                  ? "Todos los DEAs han sido verificados"
                  : filterType === "published_unverified"
                    ? "Todos los DEAs publicados ya han sido verificados manualmente"
                    : filterType === "published_verified"
                      ? "No hay DEAs que hayan sido verificados manualmente"
                      : "No hay DEAs publicados en el sistema"}
            </p>
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {aeds.map((aed) => {
                const firstImage = aed.images?.[0];
                return (
                  <div
                    key={aed.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {firstImage && (
                      <div className="h-48 bg-gray-200 overflow-hidden">
                        <img
                          src={firstImage.original_url}
                          alt={`DEA ${aed.name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {aed.code ||
                            (aed.provisional_number ? `#${aed.provisional_number}` : "Sin código")}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded ${currentFilter.badgeColor}`}
                        >
                          {currentFilter.badgeText}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Nombre:</span> {aed.name}
                        </p>
                        {aed.establishment_type && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Tipo:</span> {aed.establishment_type}
                          </p>
                        )}
                        {aed.location && (
                          <>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Dirección:</span>{" "}
                              {aed.location.street_type} {aed.location.street_name}{" "}
                              {aed.location.street_number}
                            </p>
                            {aed.location.district_name && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Distrito:</span>{" "}
                                {aed.location.district_name}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => startVerification(aed.id)}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Iniciar Verificación
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination && pagination.hasNextPage && (
              <div className="text-center">
                <button
                  onClick={loadMoreAeds}
                  disabled={loadingMore}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium text-lg min-w-[200px]"
                >
                  {loadingMore ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Cargando...
                    </div>
                  ) : (
                    `Cargar más DEAs (${pagination.totalRecords - aeds.length} restantes)`
                  )}
                </button>
              </div>
            )}

            {pagination && !pagination.hasNextPage && aeds.length > 12 && (
              <div className="text-center py-8">
                <div className="text-green-600 text-lg font-medium mb-2">
                  ✅ Todos los DEAs han sido cargados
                </div>
                <p className="text-gray-600">
                  Se han mostrado todos los {pagination.totalRecords} DEAs disponibles
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
