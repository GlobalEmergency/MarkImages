import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import proj4 from 'proj4';

// Definir sistemas de coordenadas
const utmEtrs89Zone30N = '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const wgs84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

const prisma = new PrismaClient();

interface CSVRow {
  [key: string]: string;
}

/**
 * Cargador optimizado de datos del Ayuntamiento de Madrid
 * Implementa estructura jerárquica y optimizaciones de rendimiento
 */
class OptimizedMadridDataLoader {
  private batchSize = 1000;

  async loadData() {
    console.log('🚀 Iniciando carga OPTIMIZADA de datos del Ayuntamiento de Madrid...');
    
    try {
      // Limpiar tablas existentes en orden correcto (por dependencias)
      await this.clearExistingData();
      
      // Cargar datos en orden jerárquico
      await this.loadDistritos();
      await this.loadBarrios();
      await this.loadVias();
      await this.loadViaRangos();
      await this.loadDirecciones();
      
      // Crear índices adicionales para optimización
      await this.createOptimizedIndexes();
      
      console.log('✅ Carga de datos OPTIMIZADA completada exitosamente');
      
      // Mostrar estadísticas
      await this.showStats();
      
    } catch (error) {
      console.error('❌ Error durante la carga de datos:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private async clearExistingData() {
    console.log('🧹 Limpiando datos existentes...');
    
    // Eliminar en orden inverso por dependencias
    await prisma.direccion.deleteMany();
    await prisma.viaRangoNumeracion.deleteMany();
    await prisma.via.deleteMany();
    await prisma.barrio.deleteMany();
    await prisma.distrito.deleteMany();
    
    console.log('✅ Datos existentes eliminados');
  }

  private async loadDistritos() {
    console.log('🏛️ Cargando distritos...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'Distritos-Barrios.csv');
    const data = await this.parseCSV(csvPath);
    
    // Extraer distritos únicos
    const distritosMap = new Map();
    
    data.forEach(row => {
      const codigoDistrito = parseInt(row.CODDIS);
      
      // Validar que el código de distrito sea válido
      if (isNaN(codigoDistrito) || !row.NOMDIS) {
        console.warn(`Distrito inválido encontrado: CODDIS=${row.CODDIS}, NOMDIS=${row.NOMDIS}`);
        return;
      }
      
      if (!distritosMap.has(codigoDistrito)) {
        distritosMap.set(codigoDistrito, {
          codigoDistrito,
          codigoTexto: row.COD_DIS_TX,
          nombre: row.NOMDIS,
          nombreNormalizado: this.normalizeText(row.NOMDIS),
          shapeLength: row.Shape_Leng ? parseFloat(row.Shape_Leng.replace(',', '.')) : null,
          shapeArea: row.Shape_Area ? parseFloat(row.Shape_Area.replace(',', '.')) : null,
          fechaAlta: row.FCH_ALTA ? new Date(row.FCH_ALTA) : null,
          fechaBaja: row.FCH_BAJA ? new Date(row.FCH_BAJA) : null,
          observaciones: row.OBSERVACIONES || null,
        });
      }
    });

    const distritos = Array.from(distritosMap.values());
    console.log(`📊 Procesando ${distritos.length} distritos...`);

    await prisma.distrito.createMany({
      data: distritos,
      skipDuplicates: true,
    });
    
    console.log('✅ Distritos cargados exitosamente');
  }

  private async loadBarrios() {
    console.log('🏘️ Cargando barrios...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'Distritos-Barrios.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} barrios...`);
    
    // Obtener IDs de distritos para las relaciones
    const distritos = await prisma.distrito.findMany();
    const distritoMap = new Map(distritos.map(d => [d.codigoDistrito, d.id]));
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const barrioData = batch.map(row => {
        const codigoDistrito = parseInt(row.CODDIS);
        const distritoId = distritoMap.get(codigoDistrito);
        
        if (!distritoId) {
          throw new Error(`Distrito no encontrado: ${codigoDistrito}`);
        }
        
        return {
          distritoId,
          codigoBarrio: parseInt(row.COD_BAR),
          codigoDistritoBarrio: parseInt(row.COD_DISBAR),
          numeroBarrio: parseInt(row.NUM_BAR),
          nombre: row.NOMBRE,
          nombreNormalizado: this.normalizeText(row.NOMBRE),
          nombreMayuscula: row.BARRIO_MAY,
          shapeLength: row.Shape_Leng ? parseFloat(row.Shape_Leng.replace(',', '.')) : null,
          shapeArea: row.Shape_Area ? parseFloat(row.Shape_Area.replace(',', '.')) : null,
          fechaAlta: row.FCH_ALTA ? new Date(row.FCH_ALTA) : null,
          fechaBaja: row.FCH_BAJA ? new Date(row.FCH_BAJA) : null,
        };
      });

      await prisma.barrio.createMany({
        data: barrioData,
        skipDuplicates: true,
      });

      console.log(`✅ Lote ${i + 1}/${batches.length} de barrios procesado`);
    }
    
    console.log('✅ Barrios cargados exitosamente');
  }

  private async loadVias() {
    console.log('🛣️ Cargando vías...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'VialesVigentes_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} vías...`);
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const viaData = batch.map(row => ({
        codigoVia: parseInt(row.COD_VIA),
        claseVia: row.VIA_CLASE || 'CALLE',
        particula: row.VIA_PAR || null,
        nombre: row.VIA_NOMBRE || '',
        nombreConAcentos: row.VIA_NOMBRE_ACENTOS || row.VIA_NOMBRE || '',
        nombreNormalizado: this.normalizeText(row.VIA_NOMBRE_ACENTOS || row.VIA_NOMBRE || ''),
        codigoViaInicio: row.COD_VIA_COMIENZA ? parseInt(row.COD_VIA_COMIENZA) : null,
        claseInicio: row.CLASE_COMIENZA || null,
        particulaInicio: row.PARTICULA_COMIENZA || null,
        nombreInicio: row.NOMBRE_COMIENZA || null,
        codigoViaFin: row.COD_VIA_TERMINA ? parseInt(row.COD_VIA_TERMINA) : null,
        claseFin: row.CLASE_TERMINA || null,
        particulaFin: row.PARTICULA_TERMINA || null,
        nombreFin: row.NOMBRE_TERMINA || null,
      }));

      await prisma.via.createMany({
        data: viaData,
        skipDuplicates: true,
      });

      console.log(`✅ Lote ${i + 1}/${batches.length} de vías procesado`);
    }
    
    console.log('✅ Vías cargadas exitosamente');
  }

  private async loadViaRangos() {
    console.log('📍 Cargando rangos de numeración...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'VialesVigentesDistritosBarrios_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} rangos de numeración...`);
    
    // Obtener mapas de IDs para las relaciones
    const vias = await prisma.via.findMany();
    const distritos = await prisma.distrito.findMany();
    const barrios = await prisma.barrio.findMany();
    
    const viaMap = new Map(vias.map(v => [v.codigoVia, v.id]));
    const distritoMap = new Map(distritos.map(d => [d.codigoDistrito, d.id]));
    const barrioMap = new Map(barrios.map(b => [b.codigoDistritoBarrio, b.id]));
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const rangoData = batch.map(row => {
        const codigoVia = parseInt(row.COD_VIA);
        const codigoDistrito = parseInt(row.DISTRITO);
        const codigoBarrio = row.BARRIO ? parseInt(row.BARRIO) : null;
        
        const viaId = viaMap.get(codigoVia);
        const distritoId = distritoMap.get(codigoDistrito);
        
        // Construir código distrito-barrio completo para el mapeo
        let barrioId = null;
        if (codigoBarrio && codigoDistrito) {
          // El código completo se forma como: distrito * 100 + barrio
          // Por ejemplo: distrito 8, barrio 6 = 806
          const codigoDistritoBarrio = codigoDistrito * 100 + codigoBarrio;
          barrioId = barrioMap.get(codigoDistritoBarrio);
        }
        
        if (!viaId || !distritoId) {
          console.warn(`Relación no encontrada - Vía: ${codigoVia}, Distrito: ${codigoDistrito}`);
          return null;
        }
        
        return {
          viaId,
          distritoId,
          barrioId,
          numeroImparMin: row.IMPAR_MIN ? parseInt(row.IMPAR_MIN) : null,
          numeroImparMax: row.IMPAR_MAX ? parseInt(row.IMPAR_MAX) : null,
          numeroParMin: row.PAR_MIN ? parseInt(row.PAR_MIN) : null,
          numeroParMax: row.PAR_MAX ? parseInt(row.PAR_MAX) : null,
        };
      }).filter(item => item !== null);

      if (rangoData.length > 0) {
        await prisma.viaRangoNumeracion.createMany({
          data: rangoData,
          skipDuplicates: true,
        });
      }

      console.log(`✅ Lote ${i + 1}/${batches.length} de rangos procesado`);
    }
    
    console.log('✅ Rangos de numeración cargados exitosamente');
  }

  private async loadDirecciones() {
    console.log('🏠 Cargando direcciones...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'DireccionesVigentes_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} direcciones...`);
    
    // Obtener mapas de IDs para las relaciones
    const vias = await prisma.via.findMany();
    const distritos = await prisma.distrito.findMany();
    const barrios = await prisma.barrio.findMany();
    
    const viaMap = new Map(vias.map(v => [v.codigoVia, v.id]));
    const distritoMap = new Map(distritos.map(d => [d.codigoDistrito, d.id]));
    const barrioMap = new Map(barrios.map(b => [b.codigoDistritoBarrio, b.id]));
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const direccionData = batch.map(row => {
        const codigoVia = parseInt(row.COD_VIA);
        const codigoDistrito = parseInt(row.DISTRITO);
        const codigoBarrio = row.BARRIO ? parseInt(row.BARRIO) : null;
        
        const viaId = viaMap.get(codigoVia);
        const distritoId = distritoMap.get(codigoDistrito);
        
        // Construir código distrito-barrio completo para el mapeo
        let barrioId = null;
        if (codigoBarrio && codigoDistrito) {
          // El código completo se forma como: distrito * 100 + barrio
          // Por ejemplo: distrito 8, barrio 6 = 806
          const codigoDistritoBarrio = codigoDistrito * 100 + codigoBarrio;
          barrioId = barrioMap.get(codigoDistritoBarrio);
        }
        
        if (!viaId || !distritoId) {
          console.warn(`Relación no encontrada - Vía: ${codigoVia}, Distrito: ${codigoDistrito}`);
          return null;
        }
        
        // Convertir coordenadas - PRIORIZAR UTMX_ETRS y UTMY_ETRS
        let latitud: number | null = null;
        let longitud: number | null = null;
        
        // 1. Intentar usar coordenadas UTM ETRS89 (más precisas y compatibles con GPS)
        if (row.UTMX_ETRS && row.UTMY_ETRS) {
          const utmX = parseFloat(row.UTMX_ETRS.replace(',', '.'));
          const utmY = parseFloat(row.UTMY_ETRS.replace(',', '.'));
          
          if (!isNaN(utmX) && !isNaN(utmY)) {
            const coords = this.utmEtrsToWgs84(utmX, utmY);
            if (coords) {
              latitud = coords.lat;
              longitud = coords.lng;
            }
          }
        }
        
        // 2. Fallback a coordenadas DMS si UTM no está disponible
        if (!latitud || !longitud) {
          if (row.LATITUD && row.LONGITUD) {
            latitud = this.parseCoordinate(row.LATITUD);
            longitud = this.parseCoordinate(row.LONGITUD);
          }
        }
        
        if (!latitud || !longitud) {
          console.warn(`Coordenadas inválidas para dirección: ${row.COD_VIA} ${row.NUMERO}`);
          return null;
        }
        
        return {
          viaId,
          distritoId,
          barrioId,
          claseAplicacion: row.CLASE_APP || null,
          numero: row.NUMERO ? parseInt(row.NUMERO) : null,
          calificador: row.CALIFICADOR || null,
          tipoPunto: row.TIPO_NDP || null,
          codigoPunto: row.COD_NDP ? parseInt(row.COD_NDP) : null,
          codigoPostal: row.COD_POSTAL || null,
          latitud,
          longitud,
          utmXEtrs: row.UTMX_ETRS ? parseFloat(row.UTMX_ETRS.replace(',', '.')) : null,
          utmYEtrs: row.UTMY_ETRS ? parseFloat(row.UTMY_ETRS.replace(',', '.')) : null,
          utmXEd: row.UTMX_ED ? parseFloat(row.UTMX_ED.replace(',', '.')) : null,
          utmYEd: row.UTMY_ED ? parseFloat(row.UTMY_ED.replace(',', '.')) : null,
          anguloRotulacion: row.ANGULO_ROTULACION ? parseFloat(row.ANGULO_ROTULACION.replace(',', '.')) : null,
        };
      }).filter(item => item !== null);

      if (direccionData.length > 0) {
        await prisma.direccion.createMany({
          data: direccionData,
          skipDuplicates: true,
        });
      }

      console.log(`✅ Lote ${i + 1}/${batches.length} de direcciones procesado (${((i + 1) / batches.length * 100).toFixed(1)}%)`);
    }
    
    console.log('✅ Direcciones cargadas exitosamente');
  }

  private async createOptimizedIndexes() {
    console.log('🔧 Creando índices optimizados adicionales...');
    
    try {
      // Índices espaciales para PostgreSQL
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_direcciones_spatial ON direcciones USING btree(latitud, longitud)`;
      
      // Índices de texto para búsquedas
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_distritos_nombre_gin ON distritos USING gin(to_tsvector('spanish', nombre_normalizado))`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_barrios_nombre_gin ON barrios USING gin(to_tsvector('spanish', nombre_normalizado))`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_vias_nombre_gin ON vias USING gin(to_tsvector('spanish', nombre_normalizado))`;
      
      console.log('✅ Índices optimizados creados');
    } catch (error) {
      console.warn('⚠️ Algunos índices no pudieron crearse:', error);
    }
  }

  // Funciones de utilidad
  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .replace(/Á/g, 'A')
      .replace(/É/g, 'E')
      .replace(/Í/g, 'I')
      .replace(/Ó/g, 'O')
      .replace(/Ú/g, 'U')
      .replace(/Ñ/g, 'N')
      .replace(/Ü/g, 'U')
      .replace(/Ç/g, 'C')
      .trim();
  }

  private parseCoordinate(coord: string): number | null {
    try {
      // Formato: 40°29'21.84'' N o 3°40'23.56'' W
      const match = coord.match(/(\d+)°(\d+)'([\d.]+)''/);
      if (!match) return null;
      
      const degrees = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseFloat(match[3]);
      
      let decimal = degrees + minutes / 60 + seconds / 3600;
      
      // Si es W (oeste), hacer negativo
      if (coord.includes('W')) {
        decimal = -decimal;
      }
      
      return decimal;
    } catch {
      console.warn(`Error parseando coordenada: ${coord}`);
      return null;
    }
  }

  private utmEtrsToWgs84(utmX: number, utmY: number): { lat: number; lng: number } | null {
    try {
      // Usar proj4 para conversión precisa de UTM ETRS89 Zona 30N a WGS84
      const result = proj4(utmEtrs89Zone30N, wgs84, [utmX, utmY]);
      
      if (result && result.length === 2) {
        const [lng, lat] = result;
        
        // Validar que las coordenadas estén en el rango válido para Madrid
        if (lat >= 40.0 && lat <= 41.0 && lng >= -4.0 && lng <= -3.0) {
          return { lat, lng };
        } else {
          console.warn(`Coordenadas fuera del rango válido para Madrid: ${lat}, ${lng}`);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error convirtiendo UTM ETRS89 a WGS84: ${error}`);
      return null;
    }
  }

  private utmToLatLng(utmX: number, utmY: number): { lat: number; lng: number } | null {
    try {
      // Conversión simplificada UTM Zona 30N a WGS84 para Madrid
      // Esta es una aproximación para la zona de Madrid
      const lat = 40.0 + (utmY - 4400000) / 111000;
      const lng = -3.0 + (utmX - 500000) / (111000 * Math.cos(lat * Math.PI / 180));
      
      return { lat, lng };
    } catch (error) {
      console.warn(`Error convirtiendo UTM a Lat/Lng: ${error}`);
      return null;
    }
  }

  private async parseCSV(filePath: string): Promise<CSVRow[]> {
    // Leer con encoding latin1 para caracteres especiales españoles
    let content = fs.readFileSync(filePath, 'latin1');
    
    // Remover BOM si existe
    if (content.charCodeAt(0) === 0xEF && content.charCodeAt(1) === 0xBB && content.charCodeAt(2) === 0xBF) {
      content = content.slice(3);
    }
    
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(';').map(h => h.trim().replace(/^ï»¿/, '')); // Remover BOM adicional
    const data: CSVRow[] = [];
    
    console.log(`📋 Headers encontrados: ${headers.join(', ')}`);
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const row: CSVRow = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      
      // Debug: mostrar primera fila para verificar parsing
      if (i === 1) {
        console.log(`📋 Primera fila parseada:`, row);
      }
      
      data.push(row);
    }
    
    return data;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async showStats() {
    console.log('\n📊 ESTADÍSTICAS DE CARGA OPTIMIZADA:');
    
    const distritoCount = await prisma.distrito.count();
    const barrioCount = await prisma.barrio.count();
    const viaCount = await prisma.via.count();
    const rangoCount = await prisma.viaRangoNumeracion.count();
    const direccionCount = await prisma.direccion.count();
    
    console.log(`🏛️  Distritos: ${distritoCount.toLocaleString()}`);
    console.log(`🏘️  Barrios: ${barrioCount.toLocaleString()}`);
    console.log(`🛣️  Vías: ${viaCount.toLocaleString()}`);
    console.log(`📍 Rangos de numeración: ${rangoCount.toLocaleString()}`);
    console.log(`🏠 Direcciones: ${direccionCount.toLocaleString()}`);
    
    // Estadísticas por distrito
    const districtStats = await prisma.direccion.groupBy({
      by: ['distritoId'],
      _count: {
        id: true,
      },
      orderBy: {
        distritoId: 'asc',
      },
    });
    
    console.log('\n📍 DIRECCIONES POR DISTRITO:');
    for (const stat of districtStats) {
      const distrito = await prisma.distrito.findUnique({
        where: { id: stat.distritoId }
      });
      if (distrito) {
        console.log(`   ${distrito.nombre}: ${stat._count.id.toLocaleString()} direcciones`);
      }
    }
    
    // Verificar integridad de coordenadas
    const coordenadasValidas = await prisma.direccion.count({
      where: {
        AND: [
          { latitud: { not: undefined } },
          { longitud: { not: undefined } },
          { latitud: { gte: 40.0, lte: 41.0 } }, // Rango válido para Madrid
          { longitud: { gte: -4.0, lte: -3.0 } }
        ]
      }
    });
    
    console.log(`\n🌍 Direcciones con coordenadas válidas: ${coordenadasValidas.toLocaleString()} (${((coordenadasValidas / direccionCount) * 100).toFixed(1)}%)`);
  }
}

// Ejecutar el script
async function main() {
  const loader = new OptimizedMadridDataLoader();
  await loader.loadData();
}

main().catch(console.error);
