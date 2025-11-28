import imageCompression from 'browser-image-compression';

/**
 * Opciones de compresión para mantener el tamaño bajo el límite de Vercel
 */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 2.5, // Tamaño máximo después de compresión (dejamos margen para el encoding)
  maxWidthOrHeight: 1920, // Resolución máxima
  useWebWorker: true, // Usar Web Worker para no bloquear la UI
  fileType: 'image/jpeg' as const, // Convertir todo a JPEG para mejor compresión
};

/**
 * Comprime una imagen para cumplir con los límites de tamaño de Vercel
 * @param file - Archivo de imagen a comprimir
 * @returns Archivo comprimido
 */
export async function compressImage(file: File): Promise<File> {
  try {
    // Si el archivo ya es pequeño, no comprimir
    const fileSizeInMB = file.size / 1024 / 1024;
    if (fileSizeInMB <= 2) {
      return file;
    }

    console.log('Comprimiendo imagen...', {
      originalSize: `${fileSizeInMB.toFixed(2)} MB`,
      originalType: file.type,
    });

    // Comprimir la imagen
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);

    const compressedSizeInMB = compressedFile.size / 1024 / 1024;
    console.log('Imagen comprimida:', {
      newSize: `${compressedSizeInMB.toFixed(2)} MB`,
      reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`,
    });

    return compressedFile;
  } catch (error) {
    console.error('Error al comprimir imagen:', error);
    // Si falla la compresión, intentar usar la imagen original
    throw new Error('Error al comprimir la imagen. Por favor, intenta con una imagen más pequeña.');
  }
}

/**
 * Valida el tamaño de un archivo antes de la compresión
 * @param file - Archivo a validar
 * @returns true si el archivo es válido
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  // Validar que el archivo original no sea extremadamente grande (>50MB)
  const maxOriginalSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxOriginalSize) {
    return {
      valid: false,
      error: 'La imagen es demasiado grande (máx. 50MB). Por favor, selecciona una imagen más pequeña.',
    };
  }

  return { valid: true };
}

/**
 * Valida el tipo de archivo
 * @param file - Archivo a validar
 * @returns true si el tipo es válido
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de archivo no válido. Solo se permiten JPG, PNG y WebP.',
    };
  }

  return { valid: true };
}
