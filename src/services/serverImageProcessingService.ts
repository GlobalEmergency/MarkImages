// src/services/serverImageProcessingService.ts

import sharp from 'sharp';
import type { CropperConfig, ArrowConfig, CropData, ArrowData } from '@/types/shared';
import { ARROW_CONFIG } from '@/utils/arrowConstants';

export interface ProcessedImageResult {
  imageUrl: string;
  filename: string;
  fileSize: number;
  dimensions: string;
}

export class ServerImageProcessingService {
  /**
   * Convierte una URL de imagen (data URL o HTTP) a buffer
   */
  private static async imageUrlToBuffer(imageUrl: string): Promise<Buffer> {
    if (imageUrl.startsWith('data:')) {
      // Es una data URL (base64)
      const base64Data = imageUrl.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    } else {
      // Es una URL HTTP
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar imagen: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  /**
   * Convierte un buffer a data URL
   */
  private static bufferToDataUrl(buffer: Buffer, format: string = 'jpeg'): string {
    const base64 = buffer.toString('base64');
    return `data:image/${format};base64,${base64}`;
  }

  /**
   * Genera un nombre de archivo único
   */
  private static generateUniqueFilename(baseName: string, prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = baseName.split('.').pop() || 'jpg';
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Recorta una imagen según la configuración especificada
   */
  static async cropImage(
    imageUrl: string, 
    cropData: CropData, 
    config: CropperConfig
  ): Promise<ProcessedImageResult> {
    try {
      const outputWidth = config.outputSize?.width || 1000;
      const outputHeight = config.outputSize?.height || 1000;
      
      // Convertir URL a buffer
      const inputBuffer = await this.imageUrlToBuffer(imageUrl);
      
      // Obtener metadatos de la imagen original (antes de rotación)
      const originalMetadata = await sharp(inputBuffer).metadata();
      
      if (!originalMetadata.width || !originalMetadata.height) {
        throw new Error('No se pudieron obtener las dimensiones de la imagen');
      }

      // Logging detallado para diagnóstico
      console.log('=== DIAGNÓSTICO DE RECORTE ===');
      console.log('Imagen original (física):', {
        width: originalMetadata.width,
        height: originalMetadata.height,
        format: originalMetadata.format,
        orientation: originalMetadata.orientation
      });

      // PASO CRÍTICO: Aplicar rotación EXIF manual para obtener dimensiones visuales correctas
      let rotatedImage = sharp(inputBuffer);
      let expectedWidth = originalMetadata.width;
      let expectedHeight = originalMetadata.height;

      // Aplicar rotación manual basada en EXIF orientation
      switch (originalMetadata.orientation) {
        case 1:
          // Normal, sin rotación
          break;
        case 3:
          // Rotar 180°
          rotatedImage = rotatedImage.rotate(180);
          break;
        case 6:
          // Rotar 90° horario (NUESTRO CASO)
          rotatedImage = rotatedImage.rotate(90);
          expectedWidth = originalMetadata.height;
          expectedHeight = originalMetadata.width;
          break;
        case 8:
          // Rotar 90° antihorario
          rotatedImage = rotatedImage.rotate(270);
          expectedWidth = originalMetadata.height;
          expectedHeight = originalMetadata.width;
          break;
        default:
          console.warn(`Orientación EXIF desconocida: ${originalMetadata.orientation}, usando imagen sin rotar`);
          break;
      }

      console.log('Imagen después de aplicar orientación EXIF manual:', {
        originalDimensions: { width: originalMetadata.width, height: originalMetadata.height },
        expectedDimensions: { width: expectedWidth, height: expectedHeight },
        orientation: originalMetadata.orientation,
        rotationApplied: originalMetadata.orientation !== 1
      });

      // Usar las dimensiones esperadas para validación
      const finalWidth = expectedWidth;
      const finalHeight = expectedHeight;

      console.log('Datos de recorte solicitados:', cropData);
      
      // Calcular límites del área de recorte usando las dimensiones POST-rotación
      const cropLeft = Math.round(cropData.x);
      const cropTop = Math.round(cropData.y);
      const cropWidth = Math.round(cropData.width);
      const cropHeight = Math.round(cropData.height);
      const cropRight = cropLeft + cropWidth;
      const cropBottom = cropTop + cropHeight;
      
      console.log('Área de recorte calculada:', {
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
        right: cropRight,
        bottom: cropBottom
      });

      // Validar que las coordenadas estén dentro de los límites de la imagen ROTADA
      if (cropLeft < 0 || cropTop < 0) {
        throw new Error(`Coordenadas de recorte inválidas: x=${cropLeft}, y=${cropTop}. Las coordenadas no pueden ser negativas.`);
      }

      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error(`Dimensiones de recorte inválidas: width=${cropWidth}, height=${cropHeight}. Las dimensiones deben ser positivas.`);
      }

      if (cropRight > finalWidth) {
        throw new Error(`El área de recorte excede el ancho de la imagen rotada. Solicitado: ${cropRight}px, disponible: ${finalWidth}px (original: ${originalMetadata.width}px)`);
      }

      if (cropBottom > finalHeight) {
        throw new Error(`El área de recorte excede la altura de la imagen rotada. Solicitado: ${cropBottom}px, disponible: ${finalHeight}px (original: ${originalMetadata.height}px)`);
      }

      console.log('✅ Validación de coordenadas exitosa (post-rotación)');

      // Realizar el recorte y redimensionado aplicando la rotación manual
      const processedBuffer = await rotatedImage
        .extract({
          left: cropLeft,
          top: cropTop,
          width: cropWidth,
          height: cropHeight
        })
        .resize(outputWidth, outputHeight, {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      console.log('✅ Rotación EXIF, recorte y redimensionado completado');

      // Convertir a data URL
      const resultImageUrl = this.bufferToDataUrl(processedBuffer, 'jpeg');
      const filename = this.generateUniqueFilename('cropped_image.jpg', 'cropped');
      
      return {
        imageUrl: resultImageUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions: `${outputWidth}x${outputHeight}`
      };
    } catch (error) {
      console.error('❌ Error en cropImage:', error);
      throw new Error(`Error al recortar imagen: ${error}`);
    }
  }

  /**
   * Añade una flecha a una imagen usando Sharp y SVG
   */
  static async addArrow(
    imageUrl: string, 
    arrows: ArrowData[], 
    config: ArrowConfig
  ): Promise<ProcessedImageResult> {
    try {
      // Convertir URL a buffer
      const inputBuffer = await this.imageUrlToBuffer(imageUrl);
      
      // Obtener metadatos
      const metadata = await sharp(inputBuffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('No se pudieron obtener las dimensiones de la imagen');
      }

      const width = metadata.width;
      const height = metadata.height;

      // Crear SVG con las flechas
      const arrowsSvg = arrows.map(arrow => {
        const startX = config.startPosition === 'bottom' ? width / 2 : arrow.startX;
        const startY = config.startPosition === 'bottom' ? height - 50 : arrow.startY;
        const endX = arrow.endX;
        const endY = arrow.endY;
        
        // Calcular ángulo para la punta de la flecha
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = config.headLength || ARROW_CONFIG.HEAD_LENGTH;
        const bodyWidth = config.width || ARROW_CONFIG.BODY_WIDTH;
        
        // Puntos de la punta de la flecha
        const arrowHead1X = endX - headLength * Math.cos(angle - Math.PI / 6);
        const arrowHead1Y = endY - headLength * Math.sin(angle - Math.PI / 6);
        const arrowHead2X = endX - headLength * Math.cos(angle + Math.PI / 6);
        const arrowHead2Y = endY - headLength * Math.sin(angle + Math.PI / 6);

        return `
          <g>
            <!-- Línea principal -->
            <line x1="${startX}" y1="${startY}" x2="${endX - headLength * Math.cos(angle)}" y2="${endY - headLength * Math.sin(angle)}" 
                  stroke="${ARROW_CONFIG.COLOR}" stroke-width="${bodyWidth}" 
                  stroke-linecap="round"/>
            <!-- Punta de la flecha -->
            <polygon points="${endX},${endY} ${arrowHead1X},${arrowHead1Y} ${arrowHead2X},${arrowHead2Y}" 
                     fill="${ARROW_CONFIG.COLOR}" stroke="${ARROW_CONFIG.STROKE_COLOR}" stroke-width="${ARROW_CONFIG.STROKE_WIDTH}"/>
          </g>
        `;
      }).join('');

      const svgOverlay = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          ${arrowsSvg}
        </svg>
      `;

      // Superponer el SVG sobre la imagen
      const processedBuffer = await sharp(inputBuffer)
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: 85 })
        .toBuffer();

      const resultImageUrl = this.bufferToDataUrl(processedBuffer, 'jpeg');
      const filename = this.generateUniqueFilename('image_with_arrow.jpg', 'arrow');
      
      return {
        imageUrl: resultImageUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions: `${width}x${height}`
      };
    } catch (error) {
      throw new Error(`Error al añadir flecha: ${error}`);
    }
  }

  /**
   * Redimensiona una imagen
   */
  static async resizeImage(
    imageUrl: string, 
    width: number, 
    height: number, 
    quality: number = 85
  ): Promise<ProcessedImageResult> {
    try {
      const inputBuffer = await this.imageUrlToBuffer(imageUrl);
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(width, height, {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality })
        .toBuffer();

      const resultImageUrl = this.bufferToDataUrl(processedBuffer, 'jpeg');
      const filename = this.generateUniqueFilename('resized_image.jpg', 'resized');
      
      return {
        imageUrl: resultImageUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions: `${width}x${height}`
      };
    } catch (error) {
      throw new Error(`Error al redimensionar imagen: ${error}`);
    }
  }

  /**
   * Comprime una imagen ajustando la calidad
   */
  static async compressImage(
    imageUrl: string, 
    targetSizeKB: number = 500
  ): Promise<ProcessedImageResult> {
    try {
      const inputBuffer = await this.imageUrlToBuffer(imageUrl);
      const metadata = await sharp(inputBuffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('No se pudieron obtener las dimensiones de la imagen');
      }

      // Intentar diferentes calidades hasta alcanzar el tamaño objetivo
      let quality = 85;
      let processedBuffer: Buffer;
      
      do {
        processedBuffer = await sharp(inputBuffer)
          .jpeg({ quality })
          .toBuffer();
        
        if (processedBuffer.length <= targetSizeKB * 1024) {
          break;
        }
        
        quality -= 10;
      } while (quality > 10);

      const resultImageUrl = this.bufferToDataUrl(processedBuffer, 'jpeg');
      const filename = this.generateUniqueFilename('compressed_image.jpg', 'compressed');
      
      return {
        imageUrl: resultImageUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions: `${metadata.width}x${metadata.height}`
      };
    } catch (error) {
      throw new Error(`Error al comprimir imagen: ${error}`);
    }
  }

  /**
   * Genera una miniatura de una imagen
   */
  static async generateThumbnail(
    imageUrl: string, 
    size: number = 200
  ): Promise<ProcessedImageResult> {
    try {
      const inputBuffer = await this.imageUrlToBuffer(imageUrl);
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      const resultImageUrl = this.bufferToDataUrl(processedBuffer, 'jpeg');
      const filename = this.generateUniqueFilename('thumbnail.jpg', 'thumb');
      
      return {
        imageUrl: resultImageUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions: `${size}x${size}`
      };
    } catch (error) {
      throw new Error(`Error al generar miniatura: ${error}`);
    }
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
    try {
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
    } catch (error) {
      throw new Error(`Error en procesamiento completo: ${error}`);
    }
  }
}
