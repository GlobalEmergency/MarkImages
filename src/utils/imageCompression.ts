/**
 * Comprime y redimensiona una imagen para reducir su tamaño antes de subirla
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  maxSizeMB: 2,
};

/**
 * Comprime una imagen desde un File
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        const compressed = await compressImageDataUrl(dataUrl, opts);
        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Error leyendo el archivo"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Comprime una imagen desde un data URL
 */
export async function compressImageDataUrl(
  dataUrl: string,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calcular dimensiones manteniendo aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;

        if (width > opts.maxWidth || height > opts.maxHeight) {
          if (width > height) {
            width = opts.maxWidth;
            height = width / aspectRatio;
          } else {
            height = opts.maxHeight;
            width = height * aspectRatio;
          }
        }

        // Crear canvas con las nuevas dimensiones
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo crear contexto del canvas"));
          return;
        }

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Comprimir iterativamente hasta alcanzar el tamaño deseado
        let quality = opts.quality;
        let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

        // Calcular tamaño en MB
        const sizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);

        // Si aún es muy grande, reducir calidad iterativamente
        if (sizeInMB > opts.maxSizeMB && quality > 0.5) {
          let attempts = 0;
          const maxAttempts = 5;

          while (sizeInMB > opts.maxSizeMB && quality > 0.5 && attempts < maxAttempts) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
            const newSizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);

            console.log(
              `🔄 Intento ${attempts + 1}: Calidad ${quality.toFixed(2)}, Tamaño: ${newSizeInMB.toFixed(2)}MB`
            );

            if (newSizeInMB <= opts.maxSizeMB) {
              break;
            }

            attempts++;
          }
        }

        const finalSizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);
        console.log(
          `✅ Imagen comprimida: ${width}x${height}, Calidad: ${quality.toFixed(2)}, Tamaño: ${finalSizeInMB.toFixed(2)}MB`
        );

        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Error cargando la imagen"));
    };

    img.src = dataUrl;
  });
}

/**
 * Obtiene información sobre el tamaño de una imagen
 */
export function getImageInfo(dataUrl: string): {
  sizeInBytes: number;
  sizeInMB: number;
  sizeInKB: number;
} {
  const sizeInBytes = dataUrl.length * 0.75; // Aproximación del tamaño real desde base64
  const sizeInKB = sizeInBytes / 1024;
  const sizeInMB = sizeInKB / 1024;

  return {
    sizeInBytes,
    sizeInKB,
    sizeInMB,
  };
}
