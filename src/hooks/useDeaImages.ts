"use client";

import { useState, useRef, useCallback } from "react";

/** Image types accepted for AED photos */
type AedImageType = "FRONT" | "LOCATION" | "ACCESS" | "CONTEXT";

interface DeaImage {
  file: File;
  preview: string;
  url?: string;
  type: AedImageType;
  uploading: boolean;
  error?: string;
}

/** Serialised image ready for the API payload */
interface UploadedImagePayload {
  original_url: string;
  type: string;
  order: number;
}

const MAX_IMAGES = 5;

/**
 * Hook that manages multi-image selection, preview, and batch upload to S3.
 *
 * SRP: Only responsible for image lifecycle (select → preview → upload → remove).
 * Does NOT know about forms or AED creation.
 *
 * Follows the same pattern as the existing useImageUpload hook but extended
 * for multiple images with preview URLs and batch upload.
 */
export function useDeaImages() {
  const [images, setImages] = useState<DeaImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Open the native file picker */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Handle files selected from the file input */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: DeaImage[] = (Array.from(files) as File[]).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: "CONTEXT" as AedImageType,
      uploading: false,
    }));

    setImages((prev) => {
      const combined = [...prev, ...newImages];
      // First image is always FRONT
      if (combined.length > 0 && combined[0].type !== "FRONT") {
        combined[0] = { ...combined[0], type: "FRONT" };
      }
      return combined.slice(0, MAX_IMAGES);
    });

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /** Remove an image by index and revoke its blob URL */
  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      // Promote the new first image to FRONT if needed
      if (updated.length > 0 && updated[0].type !== "FRONT") {
        updated[0] = { ...updated[0], type: "FRONT" };
      }
      return updated;
    });
  }, []);

  /**
   * Upload all pending images to S3 via /api/upload.
   * Returns the list of successfully uploaded images in API payload format.
   * Already-uploaded images (with url) are included without re-uploading.
   */
  const uploadAll = useCallback(async (): Promise<UploadedImagePayload[]> => {
    const results: UploadedImagePayload[] = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      // Skip already-uploaded
      if (img.url) {
        results.push({ original_url: img.url, type: img.type, order: i + 1 });
        continue;
      }

      // Mark uploading
      setImages((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, uploading: true } : item))
      );

      try {
        const body = new FormData();
        body.append("file", img.file);
        body.append("prefix", "dea-community");

        const res = await fetch("/api/upload", { method: "POST", body });
        if (!res.ok) throw new Error("Error al subir imagen");

        const data = await res.json();
        results.push({ original_url: data.url, type: img.type, order: i + 1 });

        setImages((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, uploading: false, url: data.url } : item))
        );
      } catch {
        setImages((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, uploading: false, error: "Error al subir" } : item
          )
        );
        // Continue uploading remaining images even if one fails
      }
    }

    return results;
  }, [images]);

  return {
    images,
    fileInputRef,
    canAddMore: images.length < MAX_IMAGES,
    openFilePicker,
    handleFileSelect,
    removeImage,
    uploadAll,
  };
}

export type { DeaImage, UploadedImagePayload };
