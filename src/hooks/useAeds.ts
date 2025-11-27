/**
 * Hook to fetch and manage AEDs
 */

import { useState, useEffect, useCallback } from "react";

import { Aed, AedsResponse, AedFilters } from "@/types/aed";

export function useAeds(filters: AedFilters = {}) {
  const [aeds, setAeds] = useState<Aed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchAeds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (filters.page) params.append("page", filters.page.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.search) params.append("search", filters.search);

      const response = await fetch(`/api/aeds?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch AEDs");
      }

      const data: AedsResponse = await response.json();

      if (data.success) {
        setAeds(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching AEDs:", err);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.limit, filters.search]);

  useEffect(() => {
    fetchAeds();
  }, [fetchAeds]);

  return {
    aeds,
    loading,
    error,
    pagination,
    refetch: fetchAeds,
  };
}
