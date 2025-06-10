// src/services/imageProcessingService.ts

import { cropImage, resizeImage, getBase64Size, generateUniqueFilename } from '@/utils/imageUtils';
import { drawArrowFromBottom } from '@/utils/canvasUtils';
import type { CropperConfig, ArrowConfig, CropData, ArrowData } from '@/types/shared';

export interface ProcessedImageResult {
  imageUrl: string;
  filename: string;
  fileSize: number;
  dimensions: string;
}

export class ImageProcessingService {
  /**
   * Recorta una imagen según la configuración especificada
   */
  static async cropImage(
    imageUrl: string, 
    cropData: CropData, 
    config: CropperConfig
  ): Promise<ProcessedImageResult> {
    const outputWidth = config.outputSize?.width || 1000;
    const outputHeight = config.outputSize?.height || 1000;
    
    const croppedImageUrl = await cropImage(
      imageUrl,
      {
        x: cropData.x,
        y: cropData.y,
        width: cropData.width,
        height: cropData.height
      },
      outputWidth,
      outputHeight
    );
    
    const fileSize = getBase64Size(croppedImageUrl);
    const filename = generateUniqueFilename('cropped_image.jpg', 'cropped');
    
    return {
      imageUrl: croppedImageUrl,
      filename,
      fileSize,
      dimensions: `${outputWidth}x${outputHeight}`
    };
  }

  /**
   * Añade una flecha a una imagen
   */
  static async addArrow(
    imageUrl: string, 
    arrows: ArrowData[], 
    config: ArrowConfig
  ): Promise<ProcessedImageResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Dibujar la imagen base
        ctx.drawImage(img, 0, 0);
        
        // Dibujar cada flecha
        arrows.forEach(arrow => {
          if (config.startPosition === 'bottom') {
            drawArrowFromBottom(
              ctx,
              canvas.width,
              canvas.height,
              { x: arrow.endX, y: arrow.endY },
              {
                color: arrow.color,
                width: arrow.width,
                headLength: config.headLength || 100,
                headWidth: config.headWidth || 100,
                borderColor: '#991b1b',
                borderWidth: 2
              }
            );
          }
        });
        
        const resultImageUrl = canvas.toDataURL('image/jpeg', 0.8);
        const fileSize = getBase64Size(resultImageUrl);
        const filename = generateUniqueFilename('image_with_arrow.jpg', 'arrow');
        
        resolve({
          imageUrl: resultImageUrl,
          filename,
          fileSize,
          dimensions: `${canvas.width}x${canvas.height}`
        });
      };
      
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = imageUrl;
    });
  }

  /**
   * Redimensiona una imagen
   */
  static async resizeImage(
    imageUrl: string, 
    width: number, 
    height: number, 
    quality: number = 0.8
  ): Promise<ProcessedImageResult> {
    const resizedImageUrl = await resizeImage(imageUrl, width, height, quality);
    const fileSize = getBase64Size(resizedImageUrl);
    const filename = generateUniqueFilename('resized_image.jpg', 'resized');
    
    return {
      imageUrl: resizedImageUrl,
      filename,
      fileSize,
      dimensions: `${width}x${height}`
    };
  }

  /**
   * Comprime una imagen ajustando la calidad
   */
  static async compressImage(
    imageUrl: string, 
    targetSizeKB: number = 500
  ): Promise<ProcessedImageResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Intentar diferentes calidades hasta alcanzar el tamaño objetivo
        let quality = 0.9;
        let compressedImageUrl = canvas.toDataURL('image/jpeg', quality);
        let currentSize = getBase64Size(compressedImageUrl);
        
        while (currentSize > targetSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          compressedImageUrl = canvas.toDataURL('image/jpeg', quality);
          currentSize = getBase64Size(compressedImageUrl);
        }
        
        const filename = generateUniqueFilename('compressed_image.jpg', 'compressed');
        
        resolve({
          imageUrl: compressedImageUrl,
          filename,
          fileSize: currentSize,
          dimensions: `${canvas.width}x${canvas.height}`
        });
      };
      
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = imageUrl;
    });
  }

  /**
   * Genera una miniatura de una imagen
   */
  static async generateThumbnail(
    imageUrl: string, 
    size: number = 200
  ): Promise<ProcessedImageResult> {
    const thumbnailUrl = await resizeImage(imageUrl, size, size, 0.7);
    const fileSize = getBase64Size(thumbnailUrl);
    const filename = generateUniqueFilename('thumbnail.jpg', 'thumb');
    
    return {
      imageUrl: thumbnailUrl,
      filename,
      fileSize,
      dimensions: `${size}x${size}`
    };
  }

  /**
   * Procesa una imagen completa: recorte + flecha + compresión
   */
  static async processImageComplete(
    originalImageUrl: string,
    cropData: CropData,
    arrows: ArrowData[],
    cropConfig: CropperConfig,
    arrowConfig: ArrowConfig
  ): Promise<{
    cropped: ProcessedImageResult;
    withArrow: ProcessedImageResult;
    thumbnail: ProcessedImageResult;
  }> {
    // 1. Recortar imagen
    const cropped = await this.cropImage(originalImageUrl, cropData, cropConfig);
    
    // 2. Añadir flecha
    const withArrow = await this.addArrow(cropped.imageUrl, arrows, arrowConfig);
    
    // 3. Generar miniatura
    const thumbnail = await this.generateThumbnail(withArrow.imageUrl);
    
    return {
      cropped,
      withArrow,
      thumbnail
    };
  }
}
