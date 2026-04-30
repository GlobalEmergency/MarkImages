/**
 * Reusable pagination component
 * Mobile-first responsive design
 */

"use client";

import type { PaginationInfo } from "@/types/data-list.types";

interface DataListPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export function DataListPagination({
  pagination,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50, 100],
}: DataListPaginationProps) {
  const { page, limit, totalCount, totalPages, hasNextPage, hasPrevPage } = pagination;

  if (totalCount === 0) return null;

  return (
    <div className="space-y-4">
      {/* Results summary */}
      <div className="text-sm text-gray-600 text-center md:text-left">
        Mostrando{" "}
        <span className="font-medium">
          {Math.min((page - 1) * limit + 1, totalCount)}-{Math.min(page * limit, totalCount)}
        </span>{" "}
        de <span className="font-medium">{totalCount}</span> resultados
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Items per page selector */}
        {onLimitChange && (
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <label className="text-sm text-gray-700">Por página:</label>
            <select
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {/* First page */}
            <button
              onClick={() => onPageChange(1)}
              disabled={!hasPrevPage}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Primera
            </button>

            {/* Previous page */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrevPage}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              â€¹
            </button>

            {/* Current page indicator */}
            <span className="px-3 py-1.5 text-sm font-medium text-gray-900">
              {page} / {totalPages}
            </span>

            {/* Next page */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNextPage}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              â€º
            </button>

            {/* Last page */}
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={!hasNextPage}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Ãšltima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
