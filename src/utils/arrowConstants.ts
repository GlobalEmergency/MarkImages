/**
 * Arrow Configuration Constants
 * Compartido entre frontend (Canvas) y backend (Sharp)
 * para garantizar consistencia visual
 */

export const ARROW_CONFIG = {
  // Dimensiones de la flecha
  HEAD_LENGTH: 50, // Longitud de la punta de la flecha
  BODY_WIDTH: 20, // Grosor del cuerpo de la flecha

  // Colores
  COLOR: "#dc2626", // Rojo principal (red-600)
  STROKE_COLOR: "#991b1b", // Rojo oscuro para el contorno (red-800)
  STROKE_WIDTH: 2, // Grosor del contorno

  // Ángulo de la punta (en radianes)
  HEAD_ANGLE: Math.PI / 6, // 30 grados
} as const;
