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
        latitud: row.LATITUD ? this.parseCoordinate(row.LATITUD) : null,
        longitud: row.LONGITUD ? this.parseCoordinate(row.LONGITUD) : null,
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
