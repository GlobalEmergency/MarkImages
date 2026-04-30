/**
 * Hook para cancelar una importación en progreso
 */

import { useState } from "react";
import toast from "react-hot-toast";

interface CancelImportResult {
  success: boolean;
  message: string;
}

export function useCancelImport() {
  const [cancelling, setCancelling] = useState(false);

  const cancelImport = async (batchId: string): Promise<CancelImportResult> => {
    setCancelling(true);

    try {
      const response = await fetch(`/api/import/${batchId}/cancel`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Error al cancelar la importación");
      }

      toast.success("Importación cancelada correctamente");

      return {
        success: true,
        message: data.message || "Importación cancelada",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(message);

      return {
        success: false,
        message,
      };
    } finally {
      setCancelling(false);
    }
  };

  return {
    cancelImport,
    cancelling,
  };
}
