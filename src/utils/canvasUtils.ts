// src/utils/canvasUtils.ts

export interface ArrowOptions {
  color: string;
  width: number;
  headLength: number;
  headWidth: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Dibuja una flecha en un canvas
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  options: ArrowOptions
): void {
  const { color, width, headLength, headWidth, borderColor, borderWidth = 0 } = options;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);
  
  ctx.save();
  
  // Trasladar y rotar desde el punto de inicio
  ctx.translate(start.x, start.y);
  ctx.rotate(angle);
  
  // Configurar estilos
  ctx.fillStyle = color;
  ctx.strokeStyle = borderColor || color;
  ctx.lineWidth = borderWidth;
  
  // Dibujar cuerpo de la flecha
  ctx.beginPath();
  ctx.rect(0, -width / 2, length - headLength, width);
  ctx.fill();
  
  if (borderWidth > 0) {
    ctx.stroke();
  }
  
  // Dibujar punta de la flecha
  ctx.beginPath();
  ctx.moveTo(length - headLength, -headWidth / 2);
  ctx.lineTo(length, 0);
  ctx.lineTo(length - headLength, headWidth / 2);
  ctx.closePath();
  ctx.fill();
  
  if (borderWidth > 0) {
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Dibuja una flecha desde la parte inferior de la imagen hasta un punto
 */
export function drawArrowFromBottom(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  targetPoint: Point,
  options: ArrowOptions
): void {
  // Calcular punto de inicio en la parte inferior
  const startPoint: Point = {
    x: targetPoint.x,
    y: canvasHeight
  };
  
  drawArrow(ctx, startPoint, targetPoint, options);
}

/**
 * Obtiene las coordenadas del mouse/touch relativas al canvas
 */
export function getCanvasCoordinates(
  event: MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  let clientX: number;
  let clientY: number;
  
  if (event instanceof MouseEvent) {
    clientX = event.clientX;
    clientY = event.clientY;
  } else {
    // TouchEvent
    const touch = event.touches[0] || event.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  }
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

/**
 * Limpia el canvas
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Dibuja una imagen en el canvas manteniendo la relación de aspecto
 */
export function drawImageToCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
): void {
  const imageAspect = image.width / image.height;
  const canvasAspect = canvasWidth / canvasHeight;
  
  let drawWidth: number;
  let drawHeight: number;
  let offsetX = 0;
  let offsetY = 0;
  
  if (imageAspect > canvasAspect) {
    // La imagen es más ancha
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imageAspect;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    // La imagen es más alta
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imageAspect;
    offsetX = (canvasWidth - drawWidth) / 2;
  }
  
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Convierte canvas a blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string = 'image/jpeg',
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo convertir el canvas a blob'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Redimensiona un canvas manteniendo el contenido
 */
export function resizeCanvas(
  canvas: HTMLCanvasElement,
  newWidth: number,
  newHeight: number
): void {
  // Guardar el contenido actual
  const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
  
  // Redimensionar
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  // Restaurar el contenido si existe
  if (imageData) {
    canvas.getContext('2d')?.putImageData(imageData, 0, 0);
  }
}

/**
 * Calcula la distancia entre dos puntos
 */
export function calculateDistance(point1: Point, point2: Point): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula el ángulo entre dos puntos en radianes
 */
export function calculateAngle(start: Point, end: Point): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/**
 * Convierte radianes a grados
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Convierte grados a radianes
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
