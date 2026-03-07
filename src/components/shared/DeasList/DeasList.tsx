/**
 * Unified DEAs List Component
 * Mobile-first responsive list with filtering and pagination
 * Use cases: Public org view, Admin org view, Admin global view
 */

"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { DataListFilters } from "../DataListFilters";
import { DataListPagination } from "../DataListPagination";
import { DeaListItem } from "./DeaListItem";
import type { DeaListItem as DeaItem, DeasListConfig } from "@/types/dea-list.types";
import type { ApiResponse, PaginationInfo, PermissionContext } from "@/types/data-list.types";

interface DeasListProps {
  organizationId?: string;
  config: DeasListConfig;
  adminMode?: boolean;
}

export function DeasList(props: DeasListProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <DeasListInner {...props} />
    </Suspense>
  );
}

function DeasListInner({ organizationId, config, adminMode = false }: DeasListProps) {
  const searchParams = useSearchParams();
  const [deas, setDeas] = useState<DeaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_permissions, _setPermissions] = useState<PermissionContext>(config.permissions);

  // Initialize filter values from URL search params (e.g. ?aed_status=INACTIVE)
  const initialFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    config.filters?.forEach((f) => {
      const urlValue = searchParams.get(f.key);
      if (urlValue) {
        filters[f.key] = urlValue;
      }
    });
    return filters;
  }, [searchParams, config.filters]);

  // Filter state
  const [filterValues, setFilterValues] = useState<Record<string, string>>(initialFilters);
  const [filtersExpanded, setFiltersExpanded] = useState(Object.keys(initialFilters).length > 0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLimit, setCurrentLimit] = useState(config.pagination?.defaultLimit || 25);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);

  // Organizations state
  const [organizations, setOrganizations] = useState<Array<{ value: string; label: string }>>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);

  // Fetch organizations for filter
  const fetchOrganizations = useCallback(async () => {
    // Only fetch if there's an organization_id filter in config
    const orgFilter = config.filters?.find((f) => f.key === "organization_id");
    if (!orgFilter || organizationsLoading || organizations.length > 0) {
      return;
    }

    try {
      setOrganizationsLoading(true);
      const response = await fetch("/api/organizations");

      if (!response.ok) {
        console.error("Error loading organizations");
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        const orgOptions = [
          { value: "", label: "Todas las organizaciones" },
          ...data.data.map((org: { id: string; name: string }) => ({
            value: org.id,
            label: org.name,
          })),
        ];
        setOrganizations(orgOptions);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally {
      setOrganizationsLoading(false);
    }
  }, [config.filters, organizations.length, organizationsLoading]);

  // Derive filters with dynamic org options (avoids mutating config prop)
  const resolvedFilters = useMemo(() => {
    if (!config.filters || organizations.length === 0) return config.filters;
    return config.filters.map((f) =>
      f.key === "organization_id" && f.type === "select" ? { ...f, options: organizations } : f
    );
  }, [config.filters, organizations]);

  // Fetch DEAs from unified API
  const fetchDeas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();

      if (organizationId) {
        params.set("organization_id", organizationId);
      }

      if (config.pagination?.enabled && config.pagination.serverSide) {
        params.set("page", currentPage.toString());
        params.set("limit", currentLimit.toString());
      }

      // Apply filters
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(`/api/deas?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Error al cargar los DEAs");
      }

      const data: ApiResponse<DeaItem> = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar los DEAs");
      }

      setDeas(data.data || []);
      setPaginationInfo(data.pagination ?? null);

      if (data.permissions) {
        _setPermissions(data.permissions);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setDeas([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, filterValues, currentPage, currentLimit, config.pagination]);

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchDeas();
  }, [fetchDeas]);

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Reset to first page when filters change
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle limit change
  const handleLimitChange = (limit: number) => {
    setCurrentLimit(limit);
    setCurrentPage(1); // Reset to first page
  };

  // Count active filters
  const activeFiltersCount = Object.values(filterValues).filter(
    (value) => value !== "" && value !== "all"
  ).length;

  // Loading state
  if (loading && deas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total count */}
      <div className="px-4">
        <p className="text-sm text-gray-600">
          {paginationInfo?.totalCount || deas.length} desfibriladores
          {organizationId ? " asignados" : ""}
        </p>
      </div>

      {/* Filters Toggle Button */}
      {resolvedFilters && resolvedFilters.length > 0 && (
        <div className="px-4">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4 ml-1" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1" />
            )}
          </button>
        </div>
      )}

      {/* Filters (Collapsible) */}
      {resolvedFilters && resolvedFilters.length > 0 && filtersExpanded && (
        <div className="px-4">
          <DataListFilters
            filters={resolvedFilters}
            values={filterValues}
            onChange={handleFilterChange}
          />
        </div>
      )}

      {/* Results count */}
      {deas.length > 0 && <p className="px-4 text-sm text-gray-600">{deas.length} resultados</p>}

      {/* DEAs List */}
      <div className="space-y-3">
        {deas.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">{config.emptyMessage || "No se encontraron DEAs"}</p>
          </div>
        ) : (
          deas.map((dea) => <DeaListItem key={dea.id} dea={dea} adminMode={adminMode} />)
        )}
      </div>

      {/* Pagination */}
      {config.pagination?.enabled && paginationInfo && (
        <DataListPagination
          pagination={paginationInfo}
          onPageChange={handlePageChange}
          onLimitChange={config.pagination.serverSide ? handleLimitChange : undefined}
          limitOptions={config.pagination.limitOptions}
        />
      )}
    </div>
  );
}
