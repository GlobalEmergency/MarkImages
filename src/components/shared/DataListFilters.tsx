/**
 * Reusable filters component for data lists
 * Mobile-first responsive design
 */

"use client";

import { Search } from "lucide-react";
import type { FilterConfig } from "@/types/data-list.types";

interface DataListFiltersProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function DataListFilters({ filters, values, onChange }: DataListFiltersProps) {
  return (
    <div className="space-y-3">
      {filters.map((filter) => {
        if (filter.type === "search") {
          return (
            <div key={filter.key} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={filter.placeholder || filter.label}
                value={values[filter.key] || ""}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          );
        }

        if (filter.type === "select") {
          return (
            <div key={filter.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1 md:hidden">
                {filter.label}
              </label>
              <select
                value={values[filter.key] || ""}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{filter.label}</option>
                {filter.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        // Multiselect - implementar si es necesario
        return null;
      })}
    </div>
  );
}
