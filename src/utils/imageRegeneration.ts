/* global CanvasRenderingContext2D */
// src/utils/imageRegeneration.ts
/**
 * Client-side image regeneration utility.
 *
 * Re-applies crop → blur → arrow processing on a canvas from stored
 * parameters so the REVIEW step can display the processed result even
 * after a page reload (the base64 data URL is NOT persisted on the server
 * to avoid 413 payload errors on Vercel).
 */

import type { ProcessedImageData } from "@/types/verification";
import type { ArrowData, BlurArea, CropData } from "@/types/shared";
import { ARROW_CONFIG } from "@/utils/arrowConstants";
import { loadImageWithRetry } from "@/utils/imageLoader";

/**
 * Regenerate a processed image from its original URL and processing params.
 * Applies crop → blur → arrow in sequence on an off-screen canvas.
 *
 * @returns data URL (image/jpeg) of the processed result
 */
export async function regenerateProcessedImage(
  originalUrl: string,
  processing: ProcessedImageData
): Promise<string> {
  // 1. Load the original image (with CORS, retries, proxy fallback)
  const { image } = await loadImageWithRetry(originalUrl, {
    maxRetries: 2,
    initialDelay: 500,
  });

  // Start with the full original image dimensions
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d")!;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);

  // 2. Crop (if specified)
  if (processing.crop_data) {
    canvas = applyCrop(canvas, processing.crop_data);
    ctx = canvas.getContext("2d")!;
  }

  // 3. Blur areas (if specified)
  if (processing.blur_areas && processing.blur_areas.length > 0) {
    applyBlurAreas(ctx, canvas, processing.blur_areas);
  }

  // 4. Arrow (if specified)
  if (processing.arrow_data) {
    drawArrow(ctx, processing.arrow_data);
  }

  // 5. Export as data URL
  return canvas.toDataURL("image/jpeg", 0.92);
}

// ── Internal helpers ──

function applyCrop(sourceCanvas: HTMLCanvasElement, crop: CropData): HTMLCanvasElement {
  const cropped = document.createElement("canvas");
  cropped.width = crop.width;
  cropped.height = crop.height;

  const ctx = cropped.getContext("2d")!;
  ctx.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return cropped;
}

function applyBlurAreas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  areas: BlurArea[]
): void {
  for (const area of areas) {
    const intensity = area.intensity || 10;

    // Extract the region pixel data
    const regionData = ctx.getImageData(area.x, area.y, area.width, area.height);

    // Create a temp canvas for the region
    const temp = document.createElement("canvas");
    temp.width = area.width;
    temp.height = area.height;
    const tempCtx = temp.getContext("2d")!;
    tempCtx.putImageData(regionData, 0, 0);

    // Redraw the region with blur filter
    ctx.save();
    ctx.filter = `blur(${intensity}px)`;
    ctx.drawImage(temp, area.x, area.y, area.width, area.height);
    ctx.restore();
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: ArrowData): void {
  const dx = arrow.endX - arrow.startX;
  const dy = arrow.endY - arrow.startY;
  const angle = Math.atan2(dy, dx);

  const headLength = ARROW_CONFIG.HEAD_LENGTH;
  const bodyWidth = ARROW_CONFIG.BODY_WIDTH;

  // Arrow body
  ctx.strokeStyle = ARROW_CONFIG.COLOR;
  ctx.lineWidth = bodyWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(arrow.startX, arrow.startY);
  ctx.lineTo(arrow.endX - headLength * Math.cos(angle), arrow.endY - headLength * Math.sin(angle));
  ctx.stroke();

  // Arrow head
  ctx.fillStyle = ARROW_CONFIG.COLOR;
  ctx.strokeStyle = ARROW_CONFIG.STROKE_COLOR;
  ctx.lineWidth = ARROW_CONFIG.STROKE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(arrow.endX, arrow.endY);
  ctx.lineTo(
    arrow.endX - headLength * Math.cos(angle - ARROW_CONFIG.HEAD_ANGLE),
    arrow.endY - headLength * Math.sin(angle - ARROW_CONFIG.HEAD_ANGLE)
  );
  ctx.lineTo(
    arrow.endX - headLength * Math.cos(angle + ARROW_CONFIG.HEAD_ANGLE),
    arrow.endY - headLength * Math.sin(angle + ARROW_CONFIG.HEAD_ANGLE)
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
