/**
 * DEA List Item - Responsive component
 * Mobile: Full card layout
 * Desktop: Compact row layout with grid
 */

"use client";

import { MapPin, CheckCircle, XCircle, Clock, AlertTriangle, HelpCircle } from "lucide-react";
import Link from "next/link";
import type { DeaListItem as DeaItemType } from "@/types/dea-list.types";
import { getStatusLabel, getStatusColor } from "@/lib/aed-status-config";

interface DeaListItemProps {
  dea: DeaItemType;
  adminMode?: boolean;
}

export function DeaListItem({ dea, adminMode = false }: DeaListItemProps) {
  const needsVerification = (lastVerified: Date | null) => {
    if (!lastVerified) return true;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    return new Date(lastVerified) < oneYearAgo;
  };

  const isActive = dea.assignment_status === "ACTIVE";
  const requiresVerification = needsVerification(dea.last_verified_at);
  const hasAssignment = dea.assignment_type !== null;

  const linkHref = adminMode ? `/admin/deas/${dea.id}` : `/dea/${dea.id}`;

  return (
    <Link
      href={linkHref}
      className="
        block bg-white rounded-xl border border-gray-200 
        hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99]
        p-4
        md:grid md:grid-cols-[auto,2fr,2fr,1fr,auto] md:items-center md:gap-4
      "
    >
      {/* Icon - Shows on mobile, hidden on desktop */}
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-3 md:mb-0 md:w-10 md:h-10">
        <MapPin className="w-6 h-6 text-blue-600 md:w-5 md:h-5" />
      </div>

      {/* Main content - vertical on mobile, part of grid on desktop */}
      <div className="flex-1 min-w-0 mb-3 md:mb-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{dea.name || "DEA sin nombre"}</h3>
          {/* Status icon - mobile only */}
          {hasAssignment && (
            <div className="md:hidden flex-shrink-0">
              {isActive ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>
          )}
        </div>
        {dea.code && <p className="text-xs text-gray-500 mb-1">Código: {dea.code}</p>}
      </div>

      {/* Address - full width on mobile, grid column on desktop */}
      <div className="mb-3 md:mb-0">
        <p className="text-sm text-gray-600 line-clamp-2 md:line-clamp-1">
          {dea.address}
          {dea.city && ` • ${dea.city}`}
        </p>
      </div>

      {/* Badges - wrap on mobile, single column on desktop */}
      <div className="flex flex-wrap gap-2 mb-3 md:mb-0 md:flex-col md:items-start">
        {/* AED status badge */}
        <span
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(dea.status)}`}
        >
          {getStatusLabel(dea.status)}
        </span>

        {dea.establishment_type && (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
            {dea.establishment_type}
          </span>
        )}

        {hasAssignment && dea.assignment_type && (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
            {getAssignmentTypeLabel(dea.assignment_type)}
          </span>
        )}

        {requiresVerification && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
            <Clock className="w-3 h-3" />
            <span className="hidden sm:inline">Requiere verificación</span>
            <span className="sm:hidden">Verificar</span>
          </span>
        )}

        {/* Coordinate validation indicator */}
        {dea.coordinate_validation === "INVALID" && (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700"
            title={
              dea.coordinate_distance
                ? `Distancia: ${dea.coordinate_distance.toFixed(1)}m`
                : "Coordenadas sospechosas"
            }
          >
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">Coords. inválidas</span>
            <span className="sm:hidden">GPS!</span>
          </span>
        )}

        {dea.coordinate_validation === "NEEDS_VALIDATION" && (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700"
            title="Las coordenadas necesitan ser validadas manualmente"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Validar coords.</span>
            <span className="sm:hidden">GPS?</span>
          </span>
        )}
      </div>

      {/* Status icon - desktop only */}
      <div className="hidden md:flex items-center justify-center flex-shrink-0">
        {hasAssignment ? (
          isActive ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )
        ) : (
          <span className="text-xs text-gray-400">Sin asignar</span>
        )}
      </div>
    </Link>
  );
}

function getAssignmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CIVIL_PROTECTION: "Protección Civil",
    CERTIFIED_COMPANY: "Empresa Certificada",
    OWNERSHIP: "Propiedad",
    MAINTENANCE: "Mantenimiento",
    VERIFICATION: "Verificación",
  };
  return labels[type] || type;
}
