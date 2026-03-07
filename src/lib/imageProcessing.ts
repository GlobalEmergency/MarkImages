/**
 * Image Processing Service
 * Procesa imágenes con crop, blur y arrow usando Sharp
 */

import sharp from "sharp";
import type { BlurArea, CropData, ArrowData } from "@/types/shared";
import { ARROW_CONFIG } from "@/utils/arrowConstants";

export interface ProcessImageOptions {
  imageBuffer: Buffer;
  cropData?: CropData;
  blurAreas?: BlurArea[];
  arrowData?: ArrowData;
}

/**
 * Descarga una imagen desde una URL
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Procesa una imagen aplicando crop, blur y arrow
 */
export async function processImage(options: ProcessImageOptions): Promise<Buffer> {
  const { imageBuffer, cropData, blurAreas, arrowData } = options;

  // Get original image dimensions for bounds checking
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  let image = sharp(imageBuffer);
  let currentWidth = imgWidth;
  let currentHeight = imgHeight;

  // 1. Aplicar crop si existe
  if (cropData) {
    // Clamp coordinates to image bounds to prevent "extract_area: bad extract area"
    const left = Math.max(0, Math.min(Math.round(cropData.x), imgWidth - 1));
    const top = Math.max(0, Math.min(Math.round(cropData.y), imgHeight - 1));
    const width = Math.max(1, Math.min(Math.round(cropData.width), imgWidth - left));
    const height = Math.max(1, Math.min(Math.round(cropData.height), imgHeight - top));

    console.log(
      `🔲 Aplicando crop: ${width}x${height} en (${left}, ${top}) [imagen: ${imgWidth}x${imgHeight}]`
    );
    image = image.extract({ left, top, width, height });
    currentWidth = width;
    currentHeight = height;
  }

  // Obtener el buffer después del crop
  let buffer = await image.toBuffer();

  // 2. Aplicar blur a las áreas marcadas
  if (blurAreas && blurAreas.length > 0) {
    console.log(`🔒 Aplicando ${blurAreas.length} área(s) de blur`);

    for (const area of blurAreas) {
      // Clamp blur area to current image bounds (post-crop dimensions)
      const left = Math.max(0, Math.min(Math.round(area.x), currentWidth - 1));
      const top = Math.max(0, Math.min(Math.round(area.y), currentHeight - 1));
      const width = Math.max(1, Math.min(Math.round(area.width), currentWidth - left));
      const height = Math.max(1, Math.min(Math.round(area.height), currentHeight - top));

      // Extraer la región a difuminar
      const blurRegion = await sharp(buffer)
        .extract({ left, top, width, height })
        .blur(area.intensity || 10)
        .toBuffer();

      // Componer la región difuminada sobre la imagen
      buffer = await sharp(buffer)
        .composite([{ input: blurRegion, left, top }])
        .toBuffer();
    }
  }

  // 3. Dibujar flecha si existe
  if (arrowData) {
    console.log(
      `🎯 Dibujando flecha desde (${arrowData.startX}, ${arrowData.startY}) hasta (${arrowData.endX}, ${arrowData.endY})`
    );

    // Re-read dimensions (may have changed after crop/blur)
    const arrowMeta = await sharp(buffer).metadata();
    const width = arrowMeta.width || currentWidth || 1000;
    const height = arrowMeta.height || currentHeight || 1000;

    // Crear SVG de la flecha
    const arrowSvg = generateArrowSVG(arrowData, width, height);

    // Componer la flecha sobre la imagen
    buffer = await sharp(buffer)
      .composite([
        {
          input: Buffer.from(arrowSvg),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();
  }

  // 4. Optimizar imagen final
  const finalImage = await sharp(buffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();

  console.log("✅ Imagen procesada exitosamente");

  return finalImage;
}

/**
 * Genera SVG de una flecha usando constantes compartidas
 */
function generateArrowSVG(arrowData: ArrowData, width: number, height: number): string {
  const { startX, startY, endX, endY } = arrowData;

  // Usar constantes compartidas para consistencia con frontend
  const color = ARROW_CONFIG.COLOR;
  const headLength = ARROW_CONFIG.HEAD_LENGTH;
  const bodyWidth = ARROW_CONFIG.BODY_WIDTH;
  const strokeColor = ARROW_CONFIG.STROKE_COLOR;
  const strokeWidth = ARROW_CONFIG.STROKE_WIDTH;
  const headAngle = ARROW_CONFIG.HEAD_ANGLE;

  // Calcular ángulo y dimensiones
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx);

  // Puntos de la punta de la flecha
  const headX1 = endX - headLength * Math.cos(angle - headAngle);
  const headY1 = endY - headLength * Math.sin(angle - headAngle);
  const headX2 = endX - headLength * Math.cos(angle + headAngle);
  const headY2 = endY - headLength * Math.sin(angle + headAngle);

  // Punto donde termina el cuerpo de la flecha
  const bodyEndX = endX - headLength * Math.cos(angle);
  const bodyEndY = endY - headLength * Math.sin(angle);

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Cuerpo de la flecha -->
      <line
        x1="${startX}"
        y1="${startY}"
        x2="${bodyEndX}"
        y2="${bodyEndY}"
        stroke="${color}"
        stroke-width="${bodyWidth}"
        stroke-linecap="round"
      />

      <!-- Punta de la flecha -->
      <polygon
        points="${endX},${endY} ${headX1},${headY1} ${headX2},${headY2}"
        fill="${color}"
        stroke="${strokeColor}"
        stroke-width="${strokeWidth}"
      />
    </svg>
  `;
}

/**
 * Procesa todas las imágenes de una verificación
 */
export interface ImageToProcess {
  imageId: string;
  originalUrl: string;
  cropData?: CropData;
  blurAreas?: BlurArea[];
  arrowData?: ArrowData;
}

export interface ProcessVerificationResult {
  processedImages: Map<string, Buffer>;
  errors: Array<{ imageId: string; error: string }>;
}

export async function processVerificationImages(
  images: ImageToProcess[]
): Promise<ProcessVerificationResult> {
  const processedImages = new Map<string, Buffer>();
  const errors: Array<{ imageId: string; error: string }> = [];

  for (const img of images) {
    console.log(`📸 Procesando imagen ${img.imageId}...`);

    try {
      // Descargar imagen original
      const imageBuffer = await downloadImage(img.originalUrl);

      // Procesar imagen
      const processedBuffer = await processImage({
        imageBuffer,
        cropData: img.cropData,
        blurAreas: img.blurAreas,
        arrowData: img.arrowData,
      });

      processedImages.set(img.imageId, processedBuffer);
      console.log(`✅ Imagen ${img.imageId} procesada`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Error procesando imagen ${img.imageId}: ${message}`);
      errors.push({ imageId: img.imageId, error: message });
      // Continue processing remaining images — don't abort the entire verification
    }
  }

  return { processedImages, errors };
}
