import { PrismaClient } from '@prisma/client';
import { 
  IAddressRepository, 
  AddressSearchCriteria, 
  AddressSearchResult, 
  SearchConfig, 
  DEFAULT_SEARCH_CONFIG 
} from '../types/address';

// Tipos para resultados de consultas SQL
interface DatabaseSearchResult {
  id: number;
  via_id: number;
  codigo_via: number;
  clase_via: string;
  via_nombre: string;
  via_nombre_acentos: string;
  numero?: number;
  codigo_postal?: string;
  distrito?: number;
  codigo_distrito?: number;
  distrito_nombre: string;
  barrio_nombre?: string;
  latitud: number;
  longitud: number;
  similarity_score?: number;
  distance_meters?: number;
}

const prisma = new PrismaClient();

export class OptimizedAddressRepository implements IAddressRepository {
  private config: SearchConfig;

  constructor(config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
    this.config = config;
  }

  /**
   * Búsqueda exacta usando consulta SQL simple
   */
  async searchByExactMatch(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]> {
    try {
      let whereClause = 'WHERE 1=1';
      
      if (criteria.streetName) {
        const normalizedName = this.normalizeText(criteria.streetName);
        whereClause += ` AND v.nombre_normalizado ILIKE '%${normalizedName}%'`;
      }

      if (criteria.streetType) {
        whereClause += ` AND v.clase_via ILIKE '%${criteria.streetType.toUpperCase()}%'`;
      }

      if (criteria.streetNumber) {
        const numero = parseInt(criteria.streetNumber);
        if (!isNaN(numero)) {
          whereClause += ` AND d.numero = ${numero}`;
        }
      }

      if (criteria.postalCode) {
        whereClause += ` AND d.codigo_postal = '${criteria.postalCode}'`;
      }

      if (typeof criteria.district === 'number') {
        whereClause += ` AND dist.codigo_distrito = ${criteria.district}`;
      }

      const results = await prisma.$queryRawUnsafe<DatabaseSearchResult[]>(`
        SELECT 
          d.id,
          d.via_id,
          v.codigo_via,
          v.clase_via,
          v.nombre as via_nombre,
          v.nombre_con_acentos as via_nombre_acentos,
          d.numero,
          d.codigo_postal,
          dist.codigo_distrito as distrito,
          dist.nombre as distrito_nombre,
          b.nombre as barrio_nombre,
          d.latitud,
          d.longitud
        FROM direcciones d
        JOIN vias v ON d.via_id = v.id
        JOIN distritos dist ON d.distrito_id = dist.id
        LEFT JOIN barrios b ON d.barrio_id = b.id
        ${whereClause}
        ORDER BY d.numero ASC
        LIMIT ${this.config.maxResults}
      `);

      return results.map(result => this.mapToAddressSearchResult(result, 1.0, 'exact'));
    } catch (error) {
      console.error('Error en búsqueda exacta:', error);
      return [];
    }
  }

  /**
   * Búsqueda fuzzy usando función de similitud con normalización mejorada
   * Prioriza coincidencias que incluyen el número de vía correcto
   */
  async searchByFuzzyMatch(
    criteria: AddressSearchCriteria, 
    threshold: number = this.config.fuzzyThreshold
  ): Promise<AddressSearchResult[]> {
    if (!criteria.streetName || !this.config.enableFuzzySearch) {
      return [];
    }

    try {
      // Usar normalización básica y normalización de nombres de vía
      const normalizedStreetName = this.normalizeText(criteria.streetName);
      const normalizedStreetNameAdvanced = this.normalizeStreetName(criteria.streetName);
      
      // Construir bonus de número si está disponible
      let numberBonus = '';
      if (criteria.streetNumber) {
        const numero = parseInt(criteria.streetNumber);
        if (!isNaN(numero)) {
          // Bonus de confianza para coincidencias exactas de número
          numberBonus = `+ CASE WHEN d.numero = ${numero} THEN 0.2 ELSE 0 END`;
        }
      }
      
      // Probar ambas normalizaciones para mayor flexibilidad
      const results = await prisma.$queryRawUnsafe<DatabaseSearchResult[]>(`
        SELECT 
          d.id,
          d.via_id,
          v.codigo_via,
          v.clase_via,
          v.nombre as via_nombre,
          v.nombre_con_acentos as via_nombre_acentos,
          d.numero,
          d.codigo_postal,
          dist.codigo_distrito as distrito,
          dist.nombre as distrito_nombre,
          b.nombre as barrio_nombre,
          d.latitud,
          d.longitud,
          LEAST(1.0, GREATEST(
            similarity(v.nombre_normalizado, '${normalizedStreetName}'),
            similarity(v.nombre_normalizado, '${normalizedStreetNameAdvanced}')
          ) ${numberBonus}) as similarity_score
        FROM direcciones d
        JOIN vias v ON d.via_id = v.id
        JOIN distritos dist ON d.distrito_id = dist.id
        LEFT JOIN barrios b ON d.barrio_id = b.id
        WHERE (
          similarity(v.nombre_normalizado, '${normalizedStreetName}') >= ${threshold}
          OR similarity(v.nombre_normalizado, '${normalizedStreetNameAdvanced}') >= ${threshold}
        )
        ORDER BY 
          similarity_score DESC,
          CASE WHEN d.numero = ${criteria.streetNumber ? parseInt(criteria.streetNumber) || 0 : 0} THEN 0 ELSE 1 END,
          d.numero ASC
        LIMIT ${this.config.maxResults}
      `);

      return results.map(result => 
        this.mapToAddressSearchResult(result, result.similarity_score || 0, 'fuzzy')
      );
    } catch (error) {
      console.error('Error en búsqueda fuzzy:', error);
      return [];
    }
  }

  /**
   * Búsqueda por proximidad geográfica
   */
  async searchByGeographicProximity(
    latitude: number, 
    longitude: number, 
    radiusMeters: number = this.config.geographicRadiusMeters
  ): Promise<AddressSearchResult[]> {
    if (!this.config.enableGeographicSearch) {
      return [];
    }

    const radiusKm = radiusMeters / 1000;

    try {
      const results = await prisma.$queryRawUnsafe<DatabaseSearchResult[]>(`
        SELECT 
          d.id,
          d.via_id,
          v.codigo_via,
          v.clase_via,
          v.nombre as via_nombre,
          v.nombre_con_acentos as via_nombre_acentos,
          d.numero,
          d.codigo_postal,
          dist.codigo_distrito as distrito,
          dist.nombre as distrito_nombre,
          b.nombre as barrio_nombre,
          d.latitud,
          d.longitud,
          (
            6371 * acos(
              cos(radians(${latitude})) * 
              cos(radians(d.latitud)) * 
              cos(radians(d.longitud) - radians(${longitude})) + 
              sin(radians(${latitude})) * 
              sin(radians(d.latitud))
            )
          ) * 1000 AS distance_meters
        FROM direcciones d
        JOIN vias v ON d.via_id = v.id
        JOIN distritos dist ON d.distrito_id = dist.id
        LEFT JOIN barrios b ON d.barrio_id = b.id
        WHERE (
          6371 * acos(
            cos(radians(${latitude})) * 
            cos(radians(d.latitud)) * 
            cos(radians(d.longitud) - radians(${longitude})) + 
            sin(radians(${latitude})) * 
            sin(radians(d.latitud))
          )
        ) <= ${radiusKm}
        ORDER BY distance_meters ASC
        LIMIT ${this.config.maxResults}
      `);

      return results.map(result => {
        const distanceMeters = result.distance_meters || 0;
        const confidence = Math.max(0, 1 - (distanceMeters / radiusMeters));
        const mappedResult = this.mapToAddressSearchResult(result, confidence, 'geographic');
        mappedResult.distance = distanceMeters;
        return mappedResult;
      });
    } catch (error) {
      console.error('Error en búsqueda geográfica:', error);
      return [];
    }
  }

  /**
   * Buscar direcciones por vía y número
   */
  async findByViaAndNumber(viaId: number, numero?: number): Promise<AddressSearchResult[]> {
    try {
      let whereClause = `WHERE d.via_id = ${viaId}`;
      
      if (numero !== undefined) {
        whereClause += ` AND d.numero = ${numero}`;
      }

      const results = await prisma.$queryRawUnsafe<DatabaseSearchResult[]>(`
        SELECT 
          d.id,
          d.via_id,
          v.codigo_via,
          v.clase_via,
          v.nombre as via_nombre,
          v.nombre_con_acentos as via_nombre_acentos,
          d.numero,
          d.codigo_postal,
          dist.codigo_distrito as distrito,
          dist.nombre as distrito_nombre,
          b.nombre as barrio_nombre,
          d.latitud,
          d.longitud
        FROM direcciones d
        JOIN vias v ON d.via_id = v.id
        JOIN distritos dist ON d.distrito_id = dist.id
        LEFT JOIN barrios b ON d.barrio_id = b.id
        ${whereClause}
        ORDER BY d.numero ASC
        LIMIT ${this.config.maxResults}
      `);

      return results.map(result => this.mapToAddressSearchResult(result, 1.0, 'exact'));
    } catch (error) {
      console.error('Error buscando por vía y número:', error);
      return [];
    }
  }

  /**
   * Búsqueda combinada que usa múltiples estrategias
   */
  async searchCombined(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]> {
    const allResults: AddressSearchResult[] = [];

    // 1. Búsqueda exacta (prioridad máxima)
    if (this.config.prioritizeExactMatches) {
      const exactResults = await this.searchByExactMatch(criteria);
      if (exactResults.length > 0) {
        return exactResults; // Si hay coincidencias exactas, devolver solo esas
      }
    }

    // 2. Búsqueda fuzzy
    if (this.config.enableFuzzySearch) {
      const fuzzyResults = await this.searchByFuzzyMatch(criteria);
      allResults.push(...fuzzyResults);
    }

    // 3. Búsqueda geográfica (si hay coordenadas)
    if (criteria.coordinates && this.config.enableGeographicSearch) {
      const geoResults = await this.searchByGeographicProximity(
        criteria.coordinates.latitude,
        criteria.coordinates.longitude
      );
      allResults.push(...geoResults);
    }

    // Eliminar duplicados y ordenar por confianza
    return this.deduplicateAndSort(allResults);
  }

  /**
   * Mapea resultado de base de datos a AddressSearchResult
   */
  private mapToAddressSearchResult(
    dbResult: DatabaseSearchResult, 
    confidence: number, 
    matchType: 'exact' | 'fuzzy' | 'partial' | 'geographic'
  ): AddressSearchResult {
    return {
      id: dbResult.id,
      viaId: dbResult.via_id,
      codigoVia: dbResult.codigo_via,
      claseVia: dbResult.clase_via,
      nombreVia: dbResult.via_nombre,
      nombreViaAcentos: dbResult.via_nombre_acentos,
      numero: dbResult.numero,
      codigoPostal: dbResult.codigo_postal,
      distrito: dbResult.distrito || dbResult.codigo_distrito || 0,
      distritoNombre: dbResult.distrito_nombre,
      barrio: dbResult.barrio_nombre,
      latitud: typeof dbResult.latitud === 'string' ? parseFloat(dbResult.latitud) : dbResult.latitud,
      longitud: typeof dbResult.longitud === 'string' ? parseFloat(dbResult.longitud) : dbResult.longitud,
      confidence,
      matchType,
      distance: dbResult.distance_meters
    };
  }

  /**
   * Normaliza texto para búsquedas
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s]/g, '') // Quitar puntuación
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normaliza nombres de vía para búsqueda más flexible
   */
  private normalizeStreetName(streetName: string): string {
    let normalized = this.normalizeText(streetName);
    
    // Remover artículos y preposiciones comunes al inicio
    const articlesAndPrepositions = [
      'de la', 'del', 'de los', 'de las', 'de',
      'la', 'el', 'los', 'las',
      'san', 'santa', 'santo'
    ];
    
    for (const article of articlesAndPrepositions) {
      if (normalized.startsWith(article + ' ')) {
        normalized = normalized.substring(article.length + 1);
        break;
      }
    }
    
    return normalized.trim();
  }

  /**
   * Elimina duplicados y ordena por confianza
   */
  private deduplicateAndSort(results: AddressSearchResult[]): AddressSearchResult[] {
    const seen = new Set<string>();
    const unique = results.filter(result => {
      const key = `${result.viaId}-${result.numero}-${result.distrito}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return unique
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxResults);
  }
}

export const optimizedAddressRepository = new OptimizedAddressRepository();
