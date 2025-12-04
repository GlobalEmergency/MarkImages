/**
 * Configuración de Detección de Duplicados
 *
 * Centraliza todos los parámetros configurables del sistema de detección
 * de duplicados para facilitar ajustes según necesidades del negocio.
 */

export const DuplicateDetectionConfig = {
  /**
   * UMBRALES DE SCORING (0-100 puntos)
   *
   * Ajusta estos valores según la precisión deseada:
   * - Valores altos = menos duplicados detectados (más estricto)
   * - Valores bajos = más duplicados detectados (más permisivo)
   */
  thresholds: {
    /**
     * Score >= 75: DUPLICADO CONFIRMADO
     * - Se rechaza la importación automáticamente
     * - Se registra como ERROR en el log
     * - Casos: duplicados exactos o casi idénticos
     * - Incluye: nombre + dirección + coordenadas = 75 puntos
     */
    confirmed: 75,

    /**
     * Score 60-74: POSIBLE DUPLICADO
     * - Se importa pero se marca con requires_attention = true
     * - Se registra como WARNING en el log
     * - Requiere revisión manual posterior
     * - Casos: misma dirección pero diferente planta/ubicación específica
     */
    possible: 60,

    /**
     * Score < 60: NO ES DUPLICADO
     * - Se importa normalmente sin marcas
     * - Sin registros en el log
     * - Casos: DEAs legítimos en ubicaciones cercanas
     */
    // El límite inferior es implícito: todo lo que esté por debajo de 'possible'
  },

  /**
   * BÚSQUEDA ESPACIAL (PostGIS)
   *
   * Radio de búsqueda cuando hay coordenadas disponibles
   */
  spatial: {
    /**
     * Radio en grados decimales (aproximadamente)
     * 0.001 grados ≈ 100 metros (varía según latitud)
     *
     * Ajustar según densidad urbana:
     * - Ciudad densa: 0.0005 (≈50m) - más conservador
     * - Ciudad normal: 0.001 (≈100m) - recomendado
     * - Ciudad dispersa: 0.002 (≈200m) - más amplio
     */
    radiusDegrees: 0.001, // ~100 metros

    /**
     * SRID (Spatial Reference System Identifier)
     * 4326 = WGS84 (estándar GPS mundial)
     */
    srid: 4326,
  },

  /**
   * BÚSQUEDA SIN COORDENADAS (Fallback)
   *
   * Estrategia cuando no hay coordenadas disponibles
   */
  fallback: {
    /**
     * Usar código postal como filtro inicial
     * Si es false, buscará en toda la BD (muy lento)
     */
    usePostalCodeFilter: true,

    /**
     * Si no hay código postal Y usePostalCodeFilter es true,
     * ¿buscar en toda la BD de todos modos?
     *
     * - true: búsqueda completa (lento, ~2-5 seg por registro)
     * - false: skip verificación de duplicados (más rápido pero menos seguro)
     */
    searchAllIfNoPostalCode: false,
  },
} as const;

/**
 * Helper type para type-safety
 */
export type DuplicateDetectionConfigType = typeof DuplicateDetectionConfig;
