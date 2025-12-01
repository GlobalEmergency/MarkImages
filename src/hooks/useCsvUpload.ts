/**
 * Hook para gestionar upload de archivos CSV y creación de batch de importación
 */

import { useState } from "react";

interface UploadState {
  uploading: boolean;
  error: string | null;
  batchId: string | null;
}

export function useCsvUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    error: null,
    batchId: null,
  });

  const uploadCsv = async (
    file: File,
    batchName: string
  ): Promise<string | null> => {
    setState({ uploading: true, error: null, batchId: null });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("batchName", batchName);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar importación");
      }

      setState({ uploading: false, error: null, batchId: data.batchId });
      return data.batchId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      setState({ uploading: false, error: message, batchId: null });
      return null;
    }
  };

  const reset = () => {
    setState({ uploading: false, error: null, batchId: null });
  };

  return {
    ...state,
    uploadCsv,
    reset,
  };
}
