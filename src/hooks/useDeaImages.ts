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
  type: AedImageType;
  order: number;
}

const MAX_IMAGES = 5;
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;

/**
 * Compress an image client-side using the Canvas API.
 *
 * Resizes to fit within MAX_DIMENSION on the longest side and re-encodes
 * as JPEG. This reduces typical mobile photos from 5-15 MB to 200 KB-2 MB,
 * making uploads faster and avoiding the Vercel 4.5 MB body-size limit.
 */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        // Still re-encode as JPEG for consistent format and smaller size
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Compression didn't help, keep original
              resolve(file);
              return;
            }
            const name = file.name.replace(/\.[^.]+$/, ".jpg");
            resolve(new File([blob], name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          JPEG_QUALITY
        );
        return;
      }

      // Scale proportionally
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };

    img.src = url;
  });
}

/**
 * Upload a single file to S3 using a presigned URL.
 *
 * 1. GET presigned URL from our backend (small JSON, auth-gated).
 * 2. PUT the file directly to S3 (no body-size limit from Vercel).
 * 3. Return the public URL.
 *
 * Falls back to the legacy /api/upload endpoint if presigning fails,
 * so existing deployments without @aws-sdk/s3-request-presigner still work.
 */
async function uploadFileToS3(file: File): Promise<string> {
  // 1. Request presigned URL
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "image/jpeg",
      prefix: "dea-community",
    }),
  });

  if (!presignRes.ok) {
    // Fallback: legacy server-side upload (may 413 for large files)
    return uploadFileLegacy(file);
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  // 2. PUT directly to S3
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Error al subir imagen a S3");
  }

  return publicUrl;
}

/** Legacy upload through the server (for backward compatibility) */
async function uploadFileLegacy(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("prefix", "dea-community");

  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) throw new Error("Error al subir imagen");

  const data = await res.json();
  return data.url;
}

/**
 * Hook that manages multi-image selection, preview, and batch upload to S3.
 *
 * SRP: Only responsible for image lifecycle (select → compress → preview → upload → remove).
 * Does NOT know about forms or AED creation.
 *
 * Upload strategy:
 * 1. Images are compressed client-side (max 2048px, JPEG 82%)
 * 2. Uploaded directly to S3 via presigned URLs (bypasses Vercel 4.5 MB limit)
 * 3. Falls back to /api/upload if presigning is unavailable
 */
export function useDeaImages() {
  const [images, setImages] = useState<DeaImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Open the native file picker */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Handle files selected from the file input */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Compress images before creating previews
    const compressed = await Promise.all(
      (Array.from(files) as File[]).map((file) => compressImage(file).catch(() => file))
    );

    const newImages: DeaImage[] = compressed.map((file) => ({
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
   * Upload all pending images to S3 via presigned URLs.
   * Returns the list of successfully uploaded images and a count of failures.
   * Already-uploaded images (with url) are included without re-uploading.
   */
  const uploadAll = useCallback(async (): Promise<{
    uploaded: UploadedImagePayload[];
    failedCount: number;
  }> => {
    const results: UploadedImagePayload[] = [];
    let failedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      // Skip already-uploaded
      if (img.url) {
        results.push({
          original_url: img.url,
          type: img.type,
          order: results.length + 1,
        });
        continue;
      }

      // Mark uploading
      setImages((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, uploading: true } : item))
      );

      try {
        const url = await uploadFileToS3(img.file);
        results.push({
          original_url: url,
          type: img.type,
          order: results.length + 1,
        });

        setImages((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, uploading: false, url } : item))
        );
      } catch {
        failedCount++;
        setImages((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, uploading: false, error: "Error al subir" } : item
          )
        );
      }
    }

    return { uploaded: results, failedCount };
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
