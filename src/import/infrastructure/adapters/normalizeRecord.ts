/**
 * Pre-procesamiento de registros: aplana objetos anidados y parsea formatos
 * geoespaciales comunes para que los fieldMappings puedan usar claves planas.
 *
 * Ejemplos:
 * - { geo_point_2d: { lon: 7.6, lat: 47.5 } }
 *   → añade "geo_point_2d.lon": 7.6, "geo_point_2d.lat": 47.5
 *
 * - { wkb_geometry: "POINT(-4.419 36.717)" }
 *   → añade "wkb_geometry.longitude": -4.419, "wkb_geometry.latitude": 36.717
 */

const WKT_POINT_RE = /^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i;

/**
 * Aplana un registro expandiendo objetos anidados y formatos geoespaciales.
 * NO modifica el registro original — devuelve una copia enriquecida.
 */
export function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result = { ...record };

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;

    // Flatten nested objects (e.g., geo_point_2d: { lon, lat })
    if (typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      for (const [subKey, subValue] of Object.entries(obj)) {
        if (subValue !== null && subValue !== undefined && typeof subValue !== "object") {
          result[`${key}.${subKey}`] = subValue;
        }
      }
      continue;
    }

    // Parse WKT POINT strings → longitude/latitude
    if (typeof value === "string") {
      const match = value.match(WKT_POINT_RE);
      if (match) {
        result[`${key}.longitude`] = parseFloat(match[1]);
        result[`${key}.latitude`] = parseFloat(match[2]);
      }
    }
  }

  return result;
}
