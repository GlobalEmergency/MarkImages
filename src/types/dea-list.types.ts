/**
 * Types for DEA list components and API
 * Domain-specific types following DDD
 */

import { FilterConfig, PaginationConfig, PermissionContext } from "./data-list.types";

export interface DeaListItem {
  id: string;
  name: string;
  code: string | null;
  address: string;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  status: string; // AED status (DRAFT, PUBLISHED, etc.)
  last_verified_at: Date | null;
  establishment_type: string | null;
  assignment_type: string | null; // Assignment type (CIVIL_PROTECTION, etc.) - null when viewing all DEAs
  assignment_status: string | null; // Assignment status (ACTIVE, REVOKED, etc.) - null when viewing all DEAs
  assigned_at: Date | null; // Assignment date - null when viewing all DEAs
  coordinate_validation: string | null; // VALID, INVALID, NEEDS_VALIDATION, NO_COMPARISON
  coordinate_distance: number | null; // Distance in meters between original and geocoded coords
}

export interface DeasListConfig {
  filters?: FilterConfig[];
  pagination?: PaginationConfig;
  permissions: PermissionContext;
  organizationId?: string; // Optional filter by organization
  emptyMessage?: string;
  onDeaClick?: (deaId: string) => void;
}

export interface DeasApiFilters {
  organization_id?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive"; // Assignment status filter
  aed_status?: string; // AED status filter (DRAFT, PUBLISHED, etc.)
  assignment_type?: string; // Assignment type filter
  sort_by?: "name" | "created_at" | "assigned_at";
  sort_order?: "asc" | "desc";
}
