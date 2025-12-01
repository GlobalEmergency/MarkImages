/**
 * Mapeo de nombres de distritos a IDs
 * Capa de Dominio - Constantes del negocio
 */

export const DISTRICT_NAME_TO_ID: Record<string, number> = {
  "1. Centro": 1,
  "Centro": 1,
  "2. Arganzuela": 2,
  "Arganzuela": 2,
  "3. Retiro": 3,
  "Retiro": 3,
  "4. Salamanca": 4,
  "Salamanca": 4,
  "5. Chamartín": 5,
  "Chamartín": 5,
  "Chamartin": 5,
  "6. Tetuán": 6,
  "Tetuán": 6,
  "Tetuan": 6,
  "7. Chamberí": 7,
  "Chamberí": 7,
  "Chamberi": 7,
  "8. Fuencarral-El Pardo": 8,
  "Fuencarral-El Pardo": 8,
  "Fuencarral": 8,
  "9. Moncloa-Aravaca": 9,
  "Moncloa-Aravaca": 9,
  "Moncloa": 9,
  "10. Latina": 10,
  "Latina": 10,
  "11. Carabanchel": 11,
  "Carabanchel": 11,
  "12. Usera": 12,
  "Usera": 12,
  "13. Puente de Vallecas": 13,
  "Puente de Vallecas": 13,
  "14. Moratalaz": 14,
  "Moratalaz": 14,
  "15. Ciudad Lineal": 15,
  "Ciudad Lineal": 15,
  "16. Hortaleza": 16,
  "Hortaleza": 16,
  "17. Villaverde": 17,
  "Villaverde": 17,
  "18. Villa de Vallecas": 18,
  "Villa de Vallecas": 18,
  "19. Vicálvaro": 19,
  "Vicálvaro": 19,
  "Vicalvaro": 19,
  "20. San Blas-Canillejas": 20,
  "San Blas-Canillejas": 20,
  "San Blas": 20,
  "21. Barajas": 21,
  "Barajas": 21,
};

export function mapDistrictNameToId(districtName: string): number | null {
  if (!districtName) {
    return null;
  }

  const normalized = districtName.trim();

  // Buscar coincidencia exacta
  if (DISTRICT_NAME_TO_ID[normalized]) {
    return DISTRICT_NAME_TO_ID[normalized];
  }

  // Buscar coincidencia case-insensitive
  const normalizedLower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(DISTRICT_NAME_TO_ID)) {
    if (key.toLowerCase() === normalizedLower) {
      return value;
    }
  }

  // Intentar extraer número del formato "9. Moncloa"
  const match = normalized.match(/^(\d+)\./);
  if (match) {
    const districtId = parseInt(match[1], 10);
    if (districtId >= 1 && districtId <= 21) {
      return districtId;
    }
  }

  return null;
}
