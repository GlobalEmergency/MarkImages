// src/utils/imageUtils.ts

import { loadImageWithProxy } from './sharePointProxy';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Redimensiona una imagen manteniendo la relación de aspecto
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: srcWidth * ratio,
    height: srcHeight * ratio
  };
}

/**
 * Convierte un archivo a base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Convierte base64 a blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Carga una imagen desde una URL (con soporte automático para SharePoint)
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return loadImageWithProxy(src);
}

/**
 * Recorta una imagen usando canvas
 */
export async function cropImage(
  imageSrc: string,
  cropArea: CropArea,
  outputWidth: number,
  outputHeight: number
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('No se pudo obtener el contexto del canvas');
  }
  
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  
  // Dibujar la imagen recortada
  ctx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputWidth,
    outputHeight
  );
  
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Redimensiona una imagen
 */
export async function resizeImage(
  imageSrc: string,
  width: number,
  height: number,
  quality: number = 0.8
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('No se pudo obtener el contexto del canvas');
  }
  
  canvas.width = width;
  canvas.height = height;
  
  ctx.drawImage(img, 0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Calcula el tamaño de un archivo base64 en bytes
 */
export function getBase64Size(base64: string): number {
  const base64Data = base64.split(',')[1];
  return Math.round((base64Data.length * 3) / 4);
}

/**
 * Genera un nombre de archivo único
 */
export function generateUniqueFilename(originalName: string, suffix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  
  const suffixPart = suffix ? `_${suffix}` : '';
  return `${baseName}_${timestamp}_${random}${suffixPart}.${extension}`;
}

/**
 * Valida si un archivo es una imagen
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}

/**
 * Obtiene las dimensiones de una imagen
 */
export async function getImageDimensions(imageSrc: string): Promise<ImageDimensions> {
  const img = await loadImage(imageSrc);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight
  };
}
