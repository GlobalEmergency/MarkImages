/**
 * Badge para mostrar el estado de una exportación
 */

import { Clock, Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";

interface ExportStatusBadgeProps {
  status: string;
}

export default function ExportStatusBadge({ status }: ExportStatusBadgeProps) {
  const getStatusConfig = (
    status: string
  ): {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
  } => {
    switch (status) {
      case "PENDING":
        return {
          label: "Pendiente",
          color: "text-gray-700",
          bgColor: "bg-gray-100",
          icon: <Clock className="w-4 h-4" />,
        };

      case "IN_PROGRESS":
        return {
          label: "Procesando",
          color: "text-blue-700",
          bgColor: "bg-blue-100",
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
        };

      case "COMPLETED":
        return {
          label: "Completado",
          color: "text-green-700",
          bgColor: "bg-green-100",
          icon: <CheckCircle2 className="w-4 h-4" />,
        };

      case "FAILED":
        return {
          label: "Fallido",
          color: "text-red-700",
          bgColor: "bg-red-100",
          icon: <XCircle className="w-4 h-4" />,
        };

      case "CANCELLED":
        return {
          label: "Cancelado",
          color: "text-gray-700",
          bgColor: "bg-gray-100",
          icon: <Ban className="w-4 h-4" />,
        };

      default:
        return {
          label: status,
          color: "text-gray-700",
          bgColor: "bg-gray-100",
          icon: <Clock className="w-4 h-4" />,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
