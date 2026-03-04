/**
 * Shared types for data list components
 * Following DDD principles and mobile-first design
 */

export type FilterType = "search" | "select" | "multiselect";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  type: FilterType;
  label: string;
  options?: FilterOption[];
  placeholder?: string;
}

export interface PaginationConfig {
  enabled: boolean;
  serverSide: boolean; // true = API handles pagination, false = client-side
  defaultLimit: number;
  limitOptions: number[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PermissionContext {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  isAdmin?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  pagination?: PaginationInfo;
  permissions?: PermissionContext;
  error?: string;
}
