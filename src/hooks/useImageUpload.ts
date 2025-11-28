import { useState } from "react";

import { compressImage } from "@/lib/imageCompression";

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
      // Compress image to ensure it stays under Vercel's 4.5MB limit
      const compressedFile = await compressImage(file, {
        maxSizeMB: 4,
        maxWidthOrHeight: 2048,
        initialQuality: 0.9,
      });

      const formData = new FormData();
      formData.append("file", compressedFile);
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
