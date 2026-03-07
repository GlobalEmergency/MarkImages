/**
 * AED Status Configuration — Single source of truth
 *
 * Centralizes labels, colors, and filter options for AED statuses.
 * Use this instead of hardcoding status strings in components.
 *
 * For the status state machine (transitions), see `./aed-status.ts`.
 */

export type AedStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "INACTIVE" | "REJECTED";

export interface AedStatusInfo {
  /** Singular label: "Borrador" */
  label: string;
  /** Plural label for filter dropdowns: "Borradores" */
  pluralLabel: string;
  /** Tailwind classes for badge background + text: "bg-gray-100 text-gray-800" */
  color: string;
  /** Tailwind class for small dot indicator: "bg-gray-400" */
  dotColor: string;
  /** Whether non-admin users can see/filter by this status */
  visibleToAll: boolean;
}

export const AED_STATUS_CONFIG: Record<AedStatus, AedStatusInfo> = {
  PUBLISHED: {
    label: "Publicado",
    pluralLabel: "Publicados",
    color: "bg-green-100 text-green-800",
    dotColor: "bg-green-500",
    visibleToAll: true,
  },
  DRAFT: {
    label: "Borrador",
    pluralLabel: "Borradores",
    color: "bg-gray-100 text-gray-800",
    dotColor: "bg-gray-400",
    visibleToAll: true,
  },
  PENDING_REVIEW: {
    label: "Pendiente de revisión",
    pluralLabel: "Pendientes de revisión",
    color: "bg-yellow-100 text-yellow-800",
    dotColor: "bg-yellow-500",
    visibleToAll: true,
  },
  REJECTED: {
    label: "Rechazado",
    pluralLabel: "Rechazados",
    color: "bg-red-100 text-red-800",
    dotColor: "bg-red-500",
    visibleToAll: true,
  },
  INACTIVE: {
    label: "Inactivo",
    pluralLabel: "Inactivos",
    color: "bg-gray-100 text-gray-600",
    dotColor: "bg-gray-300",
    visibleToAll: true,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Get singular label for a status ("Borrador", "Publicado", etc.) */
export function getStatusLabel(status: string): string {
  return AED_STATUS_CONFIG[status as AedStatus]?.label ?? status;
}

/** Get Tailwind badge classes for a status */
export function getStatusColor(status: string): string {
  return AED_STATUS_CONFIG[status as AedStatus]?.color ?? "bg-gray-100 text-gray-800";
}

// ── Pre-built filter options ────────────────────────────────────────

/** All status options with "Todos" — for admin dropdowns */
export const AED_STATUS_FILTER_OPTIONS_ALL = [
  { value: "all", label: "Todos los estados" },
  ...Object.entries(AED_STATUS_CONFIG).map(([value, { pluralLabel }]) => ({
    value,
    label: pluralLabel,
  })),
];

/** Only user-visible statuses with "Todos" — for org member dropdowns */
export const AED_STATUS_FILTER_OPTIONS_USER = [
  { value: "all", label: "Todos los estados" },
  ...Object.entries(AED_STATUS_CONFIG)
    .filter(([, info]) => info.visibleToAll)
    .map(([value, { pluralLabel }]) => ({ value, label: pluralLabel })),
];

/** All statuses without "Todos" — for checkboxes/multi-select (e.g. ExportDialog) */
export const AED_STATUS_OPTIONS = Object.entries(AED_STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));

/** Pick the right filter options based on user role */
export function getStatusFilterOptions(isAdmin: boolean) {
  return isAdmin ? AED_STATUS_FILTER_OPTIONS_ALL : AED_STATUS_FILTER_OPTIONS_USER;
}
