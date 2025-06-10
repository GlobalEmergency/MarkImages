import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  [key: string]: string;
}

class MadridDataLoader {
  private batchSize = 1000;

  async loadData() {
    console.log('🚀 Iniciando carga de datos del Ayuntamiento de Madrid...');
    
    try {
      // Limpiar tablas existentes
      await this.clearExistingData();
      
      // Cargar datos en orden
      await this.loadStreets();
      await this.loadStreetDistricts();
      await this.loadAddresses();
      
      console.log('✅ Carga de datos completada exitosamente');
      
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
    
    await prisma.madridAddress.deleteMany();
    await prisma.madridStreetDistrict.deleteMany();
    await prisma.madridStreet.deleteMany();
    
    console.log('✅ Datos existentes eliminados');
  }

  private async loadStreets() {
    console.log('📍 Cargando viales...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'VialesVigentes_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} viales...`);
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const streetData = batch.map(row => ({
        codVia: parseInt(row.COD_VIA),
        viaClase: row.VIA_CLASE || null,
        viaPar: row.VIA_PAR || null,
        viaNombre: row.VIA_NOMBRE || null,
        viaNombreAcentos: row.VIA_NOMBRE_ACENTOS || null,
        codViaComienza: row.COD_VIA_COMIENZA ? parseInt(row.COD_VIA_COMIENZA) : null,
        claseComienza: row.CLASE_COMIENZA || null,
        particulaComienza: row.PARTICULA_COMIENZA || null,
        nombreComienza: row.NOMBRE_COMIENZA || null,
        nombreAcentosComienza: row.NOMBRE_ACENTOS_COMIENZA || null,
        codViaTermina: row.COD_VIA_TERMINA ? parseInt(row.COD_VIA_TERMINA) : null,
        claseTermina: row.CLASE_TERMINA || null,
        particulaTermina: row.PARTICULA_TERMINA || null,
        nombreTermina: row.NOMBRE_TERMINA || null,
        nombreAcentosTermina: row.NOMBRE_ACENTOS_TERMINA || null,
      }));

      await prisma.madridStreet.createMany({
        data: streetData,
        skipDuplicates: true,
      });

      console.log(`✅ Lote ${i + 1}/${batches.length} de viales procesado`);
    }
    
    console.log('✅ Viales cargados exitosamente');
  }

  private async loadStreetDistricts() {
    console.log('🏘️ Cargando viales por distritos...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'VialesVigentesDistritos_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} registros de viales por distrito...`);
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const districtData = batch.map(row => ({
        codVia: parseInt(row.COD_VIA),
        viaClase: row.VIA_CLASE || null,
        viaPar: row.VIA_PAR || null,
        viaNombre: row.VIA_NOMBRE || null,
        viaNombreAcentos: row.VIA_NOMBRE_ACENTOS || null,
        distrito: row.DISTRITO ? parseInt(row.DISTRITO) : null,
        imparMin: row.IMPAR_MIN || null,
        imparMax: row.IMPAR_MAX || null,
        parMin: row.PAR_MIN || null,
        parMax: row.PAR_MAX || null,
      }));

      await prisma.madridStreetDistrict.createMany({
        data: districtData,
        skipDuplicates: true,
      });

      console.log(`✅ Lote ${i + 1}/${batches.length} de viales por distrito procesado`);
    }
    
    console.log('✅ Viales por distritos cargados exitosamente');
  }

  private async loadAddresses() {
    console.log('🏠 Cargando direcciones...');
    
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'DireccionesVigentes_20250609.csv');
    const data = await this.parseCSV(csvPath);
    
    console.log(`📊 Procesando ${data.length} direcciones...`);
    
    const batches = this.createBatches(data, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const addressData = batch.map(row => ({
        codVia: parseInt(row.COD_VIA),
        viaClase: row.VIA_CLASE || null,
        viaPar: row.VIA_PAR || null,
        viaNombre: row.VIA_NOMBRE || null,
        viaNombreAcentos: row.VIA_NOMBRE_ACENTOS || null,
        claseApp: row.CLASE_APP || null,
        numero: row.NUMERO || null,
        calificador: row.CALIFICADOR || null,
        tipoNdp: row.TIPO_NDP || null,
        codNdp: row.COD_NDP || null,
        distrito: row.DISTRITO ? parseInt(row.DISTRITO) : null,
        barrio: row.BARRIO ? parseInt(row.BARRIO) : null,
        codPostal: row.COD_POSTAL || null,
        utmxEd: row.UTMX_ED ? parseFloat(row.UTMX_ED.replace(',', '.')) : null,
        utmyEd: row.UTMY_ED ? parseFloat(row.UTMY_ED.replace(',', '.')) : null,
        utmxEtrs: row.UTMX_ETRS ? parseFloat(row.UTMX_ETRS.replace(',', '.')) : null,
        utmyEtrs: row.UTMY_ETRS ? parseFloat(row.UTMY_ETRS.replace(',', '.')) : null,
        latitud: row.LATITUD ? this.parseCoordinate(row.LATITUD) : (row.UTMX_ETRS && row.UTMY_ETRS ? this.utmToLatLng(parseFloat(row.UTMX_ETRS.replace(',', '.')), parseFloat(row.UTMY_ETRS.replace(',', '.')))?.lat : null),
        longitud: row.LONGITUD ? this.parseCoordinate(row.LONGITUD) : (row.UTMX_ETRS && row.UTMY_ETRS ? this.utmToLatLng(parseFloat(row.UTMX_ETRS.replace(',', '.')), parseFloat(row.UTMY_ETRS.replace(',', '.')))?.lng : null),
        anguloRotulacion: row.ANGULO_ROTULACION ? parseFloat(row.ANGULO_ROTULACION.replace(',', '.')) : null,
      }));

      await prisma.madridAddress.createMany({
        data: addressData,
        skipDuplicates: true,
      });

      console.log(`✅ Lote ${i + 1}/${batches.length} de direcciones procesado (${((i + 1) / batches.length * 100).toFixed(1)}%)`);
    }
    
    console.log('✅ Direcciones cargadas exitosamente');
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

  /**
   * Convierte coordenadas UTM (ETRS89) a latitud/longitud (WGS84)
   * Zona UTM 30N para Madrid
   */
  private utmToLatLng(utmX: number, utmY: number): { lat: number; lng: number } | null {
    try {
      // Parámetros para UTM Zona 30N (ETRS89)
      const a = 6378137.0; // Semi-eje mayor WGS84
      const f = 1 / 298.257223563; // Aplanamiento WGS84
      const k0 = 0.9996; // Factor de escala
      const e = Math.sqrt(2 * f - f * f); // Primera excentricidad
      const e1sq = e * e / (1 - e * e); // Segunda excentricidad al cuadrado
      const n = f / (2 - f);
      
      // Origen de la zona UTM 30N
      const falseEasting = 500000;
      const falseNorthing = 0;
      const lonOrigin = -3 * Math.PI / 180; // Meridiano central zona 30N (-3°)
      
      // Ajustar coordenadas
      const x = utmX - falseEasting;
      const y = utmY - falseNorthing;
      
      // Calcular M (distancia meridional)
      const M = y / k0;
      
      // Calcular latitud de pie (footprint latitude)
      const mu = M / (a * (1 - e * e / 4 - 3 * e * e * e * e / 64 - 5 * Math.pow(e, 6) / 256));
      
      const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
      const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
      const J2 = (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32);
      const J3 = (151 * Math.pow(e1, 3) / 96);
      const J4 = (1097 * Math.pow(e1, 4) / 512);
      
      const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);
      
      // Calcular parámetros para la conversión final
      const C1 = e1sq * Math.cos(fp) * Math.cos(fp);
      const T1 = Math.tan(fp) * Math.tan(fp);
      const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(fp) * Math.sin(fp), 1.5);
      const N1 = a / Math.sqrt(1 - e * e * Math.sin(fp) * Math.sin(fp));
      const D = x / (N1 * k0);
      
      // Calcular latitud
      const Q1 = N1 * Math.tan(fp) / R1;
      const Q2 = (D * D / 2);
      const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * Math.pow(D, 4) / 24;
      const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 1.6 * e1sq - 3 * C1 * C1) * Math.pow(D, 6) / 720;
      
      const lat = fp - Q1 * (Q2 - Q3 + Q4);
      
      // Calcular longitud
      const Q5 = D;
      const Q6 = (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
      const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * Math.pow(D, 5) / 120;
      
      const lng = lonOrigin + (Q5 - Q6 + Q7) / Math.cos(fp);
      
      // Convertir de radianes a grados
      return {
        lat: lat * 180 / Math.PI,
        lng: lng * 180 / Math.PI
      };
    } catch (error) {
      console.warn(`Error convirtiendo UTM a Lat/Lng: ${error}`);
      return null;
    }
  }

  private async parseCSV(filePath: string): Promise<CSVRow[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(';').map(h => h.trim());
    const data: CSVRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const row: CSVRow = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      
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
    console.log('\n📊 ESTADÍSTICAS DE CARGA:');
    
    const streetCount = await prisma.madridStreet.count();
    const districtCount = await prisma.madridStreetDistrict.count();
    const addressCount = await prisma.madridAddress.count();
    
    console.log(`🛣️  Viales: ${streetCount.toLocaleString()}`);
    console.log(`🏘️  Viales por distrito: ${districtCount.toLocaleString()}`);
    console.log(`🏠 Direcciones: ${addressCount.toLocaleString()}`);
    
    // Estadísticas por distrito
    const districtStats = await prisma.madridAddress.groupBy({
      by: ['distrito'],
      _count: {
        id: true,
      },
      orderBy: {
        distrito: 'asc',
      },
    });
    
    console.log('\n📍 DIRECCIONES POR DISTRITO:');
    districtStats.forEach(stat => {
      if (stat.distrito) {
        console.log(`   Distrito ${stat.distrito}: ${stat._count.id.toLocaleString()} direcciones`);
      }
    });
  }
}

// Ejecutar el script
async function main() {
  const loader = new MadridDataLoader();
  await loader.loadData();
}

main().catch(console.error);
