/**
 * Hook para gestionar acciones de importación (reanudar, cancelar)
 */

import { useState, useCallback } from "react";

interface ImportActionState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface UseImportActionsReturn {
  resumeBatch: (batchId: string) => Promise<void>;
  cancelBatch: (batchId: string) => Promise<void>;
  resuming: ImportActionState;
  cancelling: ImportActionState;
  reset: () => void;
}

export function useImportActions(): UseImportActionsReturn {
  const [resuming, setResuming] = useState<ImportActionState>({
    loading: false,
    error: null,
    success: false,
  });

  const [cancelling, setCancelling] = useState<ImportActionState>({
    loading: false,
    error: null,
    success: false,
  });

  const resumeBatch = useCallback(async (batchId: string) => {
    setResuming({ loading: true, error: null, success: false });

    try {
      const response = await fetch(`/api/import/${batchId}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to resume import");
      }

      setResuming({ loading: false, error: null, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setResuming({ loading: false, error: errorMessage, success: false });
      throw error;
    }
  }, []);

  const cancelBatch = useCallback(async (batchId: string) => {
    setCancelling({ loading: true, error: null, success: false });

    try {
      const response = await fetch(`/api/import/${batchId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to cancel import");
      }

      setCancelling({ loading: false, error: null, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setCancelling({ loading: false, error: errorMessage, success: false });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setResuming({ loading: false, error: null, success: false });
    setCancelling({ loading: false, error: null, success: false });
  }, []);

  return {
    resumeBatch,
    cancelBatch,
    resuming,
    cancelling,
    reset,
  };
}
