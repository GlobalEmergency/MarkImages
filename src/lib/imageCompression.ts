/**
 * Compresses an image file to ensure it stays under the target size
 * Uses Canvas API for client-side compression
 */

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
}

export async function compressImage(file: File, options: CompressionOptions = {}): Promise<File> {
  const {
    maxSizeMB = 4, // Target 4MB to stay under Vercel's limit
    maxWidthOrHeight = 2048,
    initialQuality = 0.9,
  } = options;

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If file is already smaller than target, return as is
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const img = new Image();

      img.onload = async () => {
        try {
          let quality = initialQuality;
          let compressedFile: File | null = null;

          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;
          if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
            if (width > height) {
              height = (height / width) * maxWidthOrHeight;
              width = maxWidthOrHeight;
            } else {
              width = (width / height) * maxWidthOrHeight;
              height = maxWidthOrHeight;
            }
          }

          // Try different quality levels until we get under the target size
          while (quality > 0.1 && (!compressedFile || compressedFile.size > maxSizeBytes)) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("No se pudo obtener el contexto del canvas"));
              return;
            }

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            const blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(
                (blob) => resolve(blob),
                file.type === "image/png" ? "image/png" : "image/jpeg",
                quality
              );
            });

            if (!blob) {
              reject(new Error("Error al comprimir la imagen"));
              return;
            }

            // Convert blob to file
            compressedFile = new File([blob], file.name, {
              type: file.type === "image/png" ? "image/png" : "image/jpeg",
              lastModified: Date.now(),
            });

            // If still too large, reduce quality
            if (compressedFile.size > maxSizeBytes) {
              quality -= 0.1;
            }
          }

          if (!compressedFile) {
            reject(new Error("Error al comprimir la imagen"));
            return;
          }

          resolve(compressedFile);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error("Error al cargar la imagen"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Error al leer el archivo"));
    };

    reader.readAsDataURL(file);
  });
}
