/**
 * Badge que muestra el estado de una importación con colores e iconos
 */

import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Ban,
} from "lucide-react";

import type { ImportStatus } from "@/types/import";

interface ImportStatusBadgeProps {
  status: ImportStatus;
  showIcon?: boolean;
}

const statusConfig = {
  PENDING: {
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
    text: "Pendiente",
    animate: false,
  },
  IN_PROGRESS: {
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: Loader2,
    text: "Procesando",
    animate: true,
  },
  COMPLETED: {
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle,
    text: "Completado",
    animate: false,
  },
  COMPLETED_WITH_ERRORS: {
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertCircle,
    text: "Con errores",
    animate: false,
  },
  FAILED: {
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
    text: "Fallido",
    animate: false,
  },
  CANCELLED: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Ban,
    text: "Cancelado",
    animate: false,
  },
};

export default function ImportStatusBadge({
  status,
  showIcon = true,
}: ImportStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}
    >
      {showIcon && (
        <Icon
          className={`w-3.5 h-3.5 ${config.animate ? "animate-spin" : ""}`}
        />
      )}
      {config.text}
    </span>
  );
}
