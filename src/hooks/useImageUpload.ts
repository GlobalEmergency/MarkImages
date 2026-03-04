import { useState } from "react";

interface UploadState {
  loading: boolean;
  error: string | null;
  url: string | null;
}

export function useImageUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    loading: false,
    error: null,
    url: null,
  });

  const uploadImage = async (file: File, prefix: string = "dea-foto"): Promise<string | null> => {
    setUploadState({ loading: true, error: null, url: null });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", prefix);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al subir la imagen");
      }

      setUploadState({ loading: false, error: null, url: result.url });
      return result.url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      setUploadState({ loading: false, error: errorMessage, url: null });
      return null;
    }
  };

  const resetUpload = () => {
    setUploadState({ loading: false, error: null, url: null });
  };

  return {
    ...uploadState,
    uploadImage,
    resetUpload,
  };
}
