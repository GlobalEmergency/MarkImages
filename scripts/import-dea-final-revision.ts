import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  [key: string]: string;
}

interface ImportStats {
  totalProcessed: number;
  updated: number;
  inserted: number;
  errors: number;
  skipped: number;
}

type MatchStrategy = 
  | 'coordinates_exact' 
  | 'address_complete' 
  | 'coordinates_extended' 
  | 'address_no_number' 
  | 'neighborhood_street' 
  | 'new'
  | 'none';

interface MatchResult {
  record: any | null;
  matchedBy: MatchStrategy;
  explanation: string;
  similarity: number;
  candidatesCount: number;
  matchedField: string;
}

interface DryRunRecord {
  action: 'update' | 'insert';
  existingId?: number;
  currentRmId?: string | null;
  newRmId: string | null;
  via: string;
  coords: string;
  tipo?: string;
  matchedBy?: MatchStrategy;
  explanation?: string;
}

interface ReportRecord {
  row_number: number;
  status: 'success' | 'error' | 'skipped' | 'warning';
  action: 'update' | 'insert' | 'skip';
  id_bbdd: string;
  defCodDea_nuevo: string;
  estrategia_match: string;
  similarity_score: number;
  candidates_count: number;
  csv_name: string;
  bbdd_field_matched: string;
  explicacion: string;
  error_message: string;
}

/**
 * Importador de registros DEA finales con merge
 * - Hace matching por coordenadas y luego por dirección
 * - Actualiza defCodDea (RM_ID) en registros existentes
 * - Inserta nuevos registros
 * - Genera CSV de reporte con detalles del matching
 */
class DeaFinalRevisionImporter {
  private batchSize = 100;
  private coordinateToleranceExact = 0.0001; // ~11 metros
  private coordinateToleranceExtended = 0.001; // ~110 metros
  private dryRun = false;
  private verbose = false;
  private dryRunRecords: DryRunRecord[] = [];
  private reportRecords: ReportRecord[] = [];
  private csvReportPath = '';
  private stats: ImportStats = {
    totalProcessed: 0,
    updated: 0,
    inserted: 0,
    errors: 0,
    skipped: 0
  };

  constructor(options: { dryRun?: boolean; verbose?: boolean } = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
  }

  async importDeas() {
    if (this.dryRun) {
      console.log('🧪 MODO DRY-RUN ACTIVADO');
      console.log('   No se modificará la base de datos');
      console.log('   Solo se simulará el proceso\n');
    }
    
    console.log('🚀 Iniciando importación de DEAs con merge...');
    console.log(`📂 Archivo: data/CSV/DEA fin revisión revisandonov25.csv`);
    
    try {
      const startTime = Date.now();
      
      // Leer y parsear el CSV
      const csvData = await this.parseCSV();
      console.log(`📊 Encontrados ${csvData.length} registros en el CSV`);
      
      // Procesar en lotes
      await this.processInBatches(csvData);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Mostrar reporte de dry-run si aplica
      if (this.dryRun) {
        this.showDryRunReport();
      }
      
      // Mostrar estadísticas finales
      this.showFinalStats(duration);
      
      // Generar CSV de reporte
      if (!this.dryRun) {
        await this.generateCsvReport();
      }
      
      console.log('\n✅ Importación completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error durante la importación:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private async parseCSV(): Promise<CSVRow[]> {
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'DEA fin revisión revisandonov25.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo CSV no encontrado: ${csvPath}`);
    }

    let content: string;
    
    try {
      content = fs.readFileSync(csvPath, 'utf8');
      
      if (content.includes('�') || content.includes('Ã')) {
        console.log('⚠️ Detectado encoding incorrecto, intentando latin1...');
        content = fs.readFileSync(csvPath, 'latin1');
      }
    } catch {
      console.log('⚠️ Error leyendo con UTF-8, intentando latin1...');
      content = fs.readFileSync(csvPath, 'latin1');
    }
    
    // Remover BOM si existe
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('El archivo CSV está vacío');
    }
    
    const headers = lines[0].split(';').map(h => h.trim());
    const data: CSVRow[] = [];
    
    console.log(`📋 Headers: ${headers.slice(0, 10).join(', ')}...`);
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const row: CSVRow = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      
      // Verificar que tenga datos mínimos
      if (this.hasMinimumData(row)) {
        data.push(row);
      }
    }
    
    return data;
  }

  private hasMinimumData(row: CSVRow): boolean {
    return !!(
      row['latitude'] &&
      row['longitude'] &&
      row['name of road']
    );
  }

  private async processInBatches(csvData: CSVRow[]) {
    const batches = this.createBatches(csvData, this.batchSize);
    
    console.log(`\n📦 Procesando ${csvData.length} registros en ${batches.length} lotes de ${this.batchSize}...\n`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n🔄 Procesando lote ${i + 1}/${batches.length}...`);
      
      for (const row of batch) {
        await this.processRecord(row, i * this.batchSize + batch.indexOf(row) + 1);
      }
      
      const progress = ((this.stats.totalProcessed / csvData.length) * 100).toFixed(1);
      console.log(`   📊 Progreso: ${this.stats.totalProcessed}/${csvData.length} (${progress}%)`);
      console.log(`   ✅ Actualizados: ${this.stats.updated} | ➕ Insertados: ${this.stats.inserted} | ❌ Errores: ${this.stats.errors}`);
    }
  }

  private async processRecord(row: CSVRow, rowNumber: number) {
    const csvName = row['name'] || '';
    const rmId = row['RM_ID'] || '';
    
    try {
      this.stats.totalProcessed++;
      
      // Parsear coordenadas
      const latitude = this.parseFloat(row['latitude']);
      const longitude = this.parseFloat(row['longitude']);
      
      if (!latitude || !longitude) {
        console.warn(`⚠️ Fila ${rowNumber}: Coordenadas inválidas, saltando...`);
        this.stats.skipped++;
        
        // Registrar en reporte si no es dry-run
        if (!this.dryRun) {
          this.reportRecords.push({
            row_number: rowNumber,
            status: 'skipped',
            action: 'skip',
            id_bbdd: '',
            defCodDea_nuevo: rmId,
            estrategia_match: 'none',
            similarity_score: 0,
            candidates_count: 0,
            csv_name: csvName,
            bbdd_field_matched: '',
            explicacion: 'Coordenadas inválidas',
            error_message: `latitude=${row['latitude']}, longitude=${row['longitude']}`
          });
        }
        return;
      }

      // Buscar registro existente
      const matchResult = await this.findExistingRecord(row, latitude, longitude);

      if (matchResult.record && matchResult.matchedBy !== 'new') {
        // ACTUALIZAR: Solo el RM_ID
        await this.updateRecord(matchResult.record.id, row, rowNumber, matchResult);
      } else {
        // INSERTAR: Registro nuevo
        await this.insertRecord(row, rowNumber, matchResult);
      }
      
    } catch (error) {
      this.stats.errors++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error en fila ${rowNumber}:`, error);
      
      // Registrar error en reporte si no es dry-run
      if (!this.dryRun) {
        this.reportRecords.push({
          row_number: rowNumber,
          status: 'error',
          action: 'skip',
          id_bbdd: '',
          defCodDea_nuevo: rmId,
          estrategia_match: 'none',
          similarity_score: 0,
          candidates_count: 0,
          csv_name: csvName,
          bbdd_field_matched: '',
          explicacion: 'Error durante el procesamiento',
          error_message: errorMsg
        });
      }
    }
  }

  private async findExistingRecord(
    row: CSVRow,
    latitude: number,
    longitude: number
  ): Promise<MatchResult> {
    const typeOfRoad = row['type of road'] || '';
    const nameOfRoad = row['name of road'] || '';
    const numberOfRoad = row['number of road'] || '';
    const zipCode = row['zip code'] || '';
    const neighborhood = row['neighborhood'] || '';
    const csvName = row['name'] || '';

    // ESTRATEGIA 1: Coordenadas exactas (±0.0001° = ~11m)
    const candidatesByCoords = await prisma.deaRecord.findMany({
      where: {
        AND: [
          { defLat: { gte: latitude - this.coordinateToleranceExact, lte: latitude + this.coordinateToleranceExact } },
          { defLon: { gte: longitude - this.coordinateToleranceExact, lte: longitude + this.coordinateToleranceExact } }
        ]
      }
    });

    if (candidatesByCoords.length > 0) {
      if (candidatesByCoords.length > 1 && csvName) {
        const bestMatch = this.findBestTextMatch(csvName, candidatesByCoords);
        
        if (bestMatch.record) {
          const distance = this.calculateDistance(latitude, longitude, bestMatch.record.defLat!, bestMatch.record.defLon!);
          return {
            record: bestMatch.record,
            matchedBy: 'coordinates_exact',
            explanation: `Match por coordenadas + texto - Distancia: ${distance.toFixed(1)}m - Similitud: ${bestMatch.similarity.toFixed(0)}%`,
            similarity: bestMatch.similarity,
            candidatesCount: candidatesByCoords.length,
            matchedField: bestMatch.matchedField
          };
        }
      }
      
      const record = candidatesByCoords[0];
      const distance = this.calculateDistance(latitude, longitude, record.defLat!, record.defLon!);
      const hasWarning = candidatesByCoords.length > 1;
      
      return { 
        record, 
        matchedBy: 'coordinates_exact',
        explanation: `Match por coordenadas - Distancia: ${distance.toFixed(1)}m${hasWarning ? ` - ADVERTENCIA: ${candidatesByCoords.length} DEAs en misma ubicación` : ''}`,
        similarity: 0,
        candidatesCount: candidatesByCoords.length,
        matchedField: ''
      };
    }

    // ESTRATEGIA 2: Dirección completa
    if (typeOfRoad && nameOfRoad && zipCode) {
      const byAddressComplete = await prisma.deaRecord.findFirst({
        where: {
          defTipoVia: typeOfRoad,
          defNombreVia: nameOfRoad,
          defNumero: numberOfRoad || null,
          defCp: zipCode
        }
      });

      if (byAddressComplete) {
        return { 
          record: byAddressComplete, 
          matchedBy: 'address_complete',
          explanation: `Match por dirección completa: ${typeOfRoad} ${nameOfRoad}, ${numberOfRoad || 's/n'}, ${zipCode}`,
          similarity: 0,
          candidatesCount: 1,
          matchedField: 'address'
        };
      }
    }

    // ESTRATEGIA 3: Coordenadas ampliadas
    const byCoordinatesExtended = await prisma.deaRecord.findFirst({
      where: {
        AND: [
          { defLat: { gte: latitude - this.coordinateToleranceExtended, lte: latitude + this.coordinateToleranceExtended } },
          { defLon: { gte: longitude - this.coordinateToleranceExtended, lte: longitude + this.coordinateToleranceExtended } }
        ]
      }
    });

    if (byCoordinatesExtended) {
      const distance = this.calculateDistance(latitude, longitude, byCoordinatesExtended.defLat!, byCoordinatesExtended.defLon!);
      return { 
        record: byCoordinatesExtended, 
        matchedBy: 'coordinates_extended',
        explanation: `Match por coordenadas ampliadas - Distancia: ${distance.toFixed(1)}m`,
        similarity: 0,
        candidatesCount: 1,
        matchedField: 'coordinates'
      };
    }

    // ESTRATEGIA 4: Dirección sin número
    if (typeOfRoad && nameOfRoad && zipCode) {
      const byAddressNoNumber = await prisma.deaRecord.findFirst({
        where: {
          defTipoVia: typeOfRoad,
          defNombreVia: nameOfRoad,
          defCp: zipCode
        }
      });

      if (byAddressNoNumber) {
        return { 
          record: byAddressNoNumber, 
          matchedBy: 'address_no_number',
          explanation: `Match por dirección sin número: ${typeOfRoad} ${nameOfRoad}, ${zipCode}`,
          similarity: 0,
          candidatesCount: 1,
          matchedField: 'address_partial'
        };
      }
    }

    // ESTRATEGIA 5: Barrio + nombre de vía
    if (neighborhood && nameOfRoad) {
      const byNeighborhoodStreet = await prisma.deaRecord.findFirst({
        where: {
          defBarrio: neighborhood,
          defNombreVia: nameOfRoad
        }
      });

      if (byNeighborhoodStreet) {
        return { 
          record: byNeighborhoodStreet, 
          matchedBy: 'neighborhood_street',
          explanation: `Match por barrio (${neighborhood}) + vía (${nameOfRoad})`,
          similarity: 0,
          candidatesCount: 1,
          matchedField: 'neighborhood'
        };
      }
    }

    return { 
      record: null, 
      matchedBy: 'new',
      explanation: `NO MATCH - Nuevo registro insertado`,
      similarity: 0,
      candidatesCount: 0,
      matchedField: ''
    };
  }

  private findBestTextMatch(
    csvName: string,
    candidates: any[]
  ): { record: any | null; similarity: number; matchedField: string } {
    let bestMatch: any = null;
    let bestSimilarity = 0;
    let bestField = '';

    const csvNameLower = csvName.toLowerCase();

    for (const candidate of candidates) {
      if (candidate.complementoDireccion) {
        const similarity = this.calculateTextSimilarity(csvNameLower, candidate.complementoDireccion.toLowerCase());
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = candidate;
          bestField = 'complementoDireccion';
        }
      }

      if (candidate.descripcionAcceso) {
        const similarity = this.calculateTextSimilarity(csvNameLower, candidate.descripcionAcceso.toLowerCase());
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = candidate;
          bestField = 'descripcionAcceso';
        }
      }

      if (candidate.propuestaDenominacion) {
        const similarity = this.calculateTextSimilarity(csvNameLower, candidate.propuestaDenominacion.toLowerCase());
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = candidate;
          bestField = 'propuestaDenominacion';
        }
      }
    }

    if (bestSimilarity > 30) {
      return { record: bestMatch, similarity: bestSimilarity, matchedField: bestField };
    }

    return { record: null, similarity: 0, matchedField: '' };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const norm1 = normalize(text1);
    const norm2 = normalize(text2);

    const stopWords = ['de', 'la', 'el', 'en', 'del', 'las', 'los', 'y', 'a', 'con', 'por', 'para'];
    const words1 = norm1.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
    const words2 = norm2.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));

    if (words1.length === 0 || words2.length === 0) return 0;

    let commonWords = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          commonWords++;
          break;
        }
      }
    }

    return (commonWords / Math.max(words1.length, words2.length)) * 100;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private async updateRecord(id: number, row: CSVRow, rowNumber: number, matchResult: MatchResult) {
    const rmId = row['RM_ID'] || null;
    const csvName = row['name'] || '';
    
    try {
      if (this.dryRun) {
        const currentRecord = await prisma.deaRecord.findUnique({
          where: { id },
          select: { defCodDea: true, defNombreVia: true, defNumero: true, tipoEstablecimiento: true }
        });
        
        if (currentRecord) {
          this.dryRunRecords.push({
            action: 'update',
            existingId: id,
            currentRmId: currentRecord.defCodDea,
            newRmId: rmId,
            via: `${row['type of road'] || ''} ${row['name of road'] || ''}, ${row['number of road'] || 's/n'}`,
            coords: `${row['latitude']}, ${row['longitude']}`,
            tipo: currentRecord.tipoEstablecimiento,
            matchedBy: matchResult.matchedBy,
            explanation: matchResult.explanation
          });
        }
        
        this.stats.updated++;
      } else {
        await prisma.deaRecord.update({
          where: { id },
          data: {
            defCodDea: rmId,
            updatedAt: new Date()
          }
        });
        
        const status: 'success' | 'warning' = matchResult.candidatesCount > 1 && matchResult.similarity === 0 ? 'warning' : 'success';
        
        this.reportRecords.push({
          row_number: rowNumber,
          status,
          action: 'update',
          id_bbdd: id.toString(),
          defCodDea_nuevo: rmId || '',
          estrategia_match: matchResult.matchedBy,
          similarity_score: matchResult.similarity,
          candidates_count: matchResult.candidatesCount,
          csv_name: csvName,
          bbdd_field_matched: matchResult.matchedField,
          explicacion: matchResult.explanation,
          error_message: ''
        });
        
        this.stats.updated++;
      }
      
    } catch (error) {
      console.error(`❌ Error actualizando registro ${id} (fila ${rowNumber}):`, error);
      throw error;
    }
  }

  private async insertRecord(row: CSVRow, rowNumber: number, matchResult: MatchResult) {
    try {
      const recordData = this.mapCsvToDeaRecord(row, rowNumber);
      const rmId = row['RM_ID'] || null;
      const csvName = row['name'] || '';
      
      if (this.dryRun) {
        this.dryRunRecords.push({
          action: 'insert',
          newRmId: rmId,
          via: `${row['type of road'] || ''} ${row['name of road'] || ''}, ${row['number of road'] || 's/n'}`,
          coords: `${row['latitude']}, ${row['longitude']}`,
          tipo: row['type'] || 'No especificado',
          matchedBy: 'new',
          explanation: matchResult.explanation
        });
        
        this.stats.inserted++;
      } else {
        const created = await prisma.deaRecord.create({
          data: recordData
        });
        
        this.reportRecords.push({
          row_number: rowNumber,
          status: 'success',
          action: 'insert',
          id_bbdd: created.id.toString(),
          defCodDea_nuevo: rmId || '',
          estrategia_match: 'new',
          similarity_score: 0,
          candidates_count: 0,
          csv_name: csvName,
          bbdd_field_matched: '',
          explicacion: matchResult.explanation,
          error_message: ''
        });
        
        this.stats.inserted++;
      }
      
    } catch (error) {
      console.error(`❌ Error insertando registro (fila ${rowNumber}):`, error);
      throw error;
    }
  }

  private mapCsvToDeaRecord(row: CSVRow, rowNumber: number) {
    const excelId = this.parseInt(row['excel_id']) || 0;
    const latitude = this.parseFloat(row['latitude']);
    const longitude = this.parseFloat(row['longitude']);
    const zipCode = this.parseInt(row['zip code']);

    if (!latitude || !longitude || !zipCode) {
      throw new Error(`Datos obligatorios faltantes en fila ${rowNumber}`);
    }

    const openingMonFri = this.parseInt(row['opening Mon-Fri']) || 0;
    const closingMonFri = this.parseInt(row['closing Mon-Fri']) || 0;
    const openingSat = this.parseInt(row['opening Sat']) || 0;
    const closingSat = this.parseInt(row['closing Sat']) || 0;
    const openingSun = this.parseInt(row['opening Sun']) || 0;
    const closingSun = this.parseInt(row['closing Sun']) || 0;

    const now = new Date();

    return {
      horaInicio: now,
      horaFinalizacion: now,
      correoElectronico: 'importacion@dea.madrid.es',
      nombre: row['name'] || `DEA ${excelId}`,
      numeroProvisionalDea: excelId,
      tipoEstablecimiento: row['type'] || 'No especificado',
      titularidadLocal: 'No especificado',
      usoLocal: 'No especificado',
      titularidad: row['property'] || 'No especificado',
      propuestaDenominacion: row['owner'] || 'Sin denominación',
      tipoVia: row['type of road'] || 'Calle',
      nombreVia: row['name of road'] || 'Sin nombre',
      numeroVia: row['number of road'] || null,
      complementoDireccion: null,
      codigoPostal: zipCode,
      distrito: row['district'] || 'No especificado',
      latitud: latitude,
      longitud: longitude,
      horarioApertura: row['opening 24/7?'] || '24 horas',
      aperturaLunesViernes: openingMonFri,
      cierreLunesViernes: closingMonFri,
      aperturaSabados: openingSat,
      cierreSabados: closingSat,
      aperturaDomingos: openingSun,
      cierreDomingos: closingSun,
      vigilante24h: row['security guard 24/7'] || 'No especificado',
      foto1: null,
      foto2: null,
      descripcionAcceso: row['notes1'] || null,
      comentarioLibre: row['notes2'] || null,
      gmTipoVia: null,
      gmNombreVia: null,
      gmNumero: null,
      gmCp: null,
      gmDistrito: null,
      gmBarrio: null,
      gmLat: null,
      gmLon: null,
      defTipoVia: row['type of road'] || null,
      defNombreVia: row['name of road'] || null,
      defNumero: row['number of road'] || null,
      defCp: row['zip code'] || null,
      defDistrito: row['district'] || null,
      defBarrio: row['neighborhood'] || null,
      defLat: latitude,
      defLon: longitude,
      defCodDea: row['RM_ID'] || null,
      imageVerificationStatus: 'pending',
      addressValidationStatus: 'pending'
    };
  }

  private async generateCsvReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    this.csvReportPath = path.join(exportDir, `import-report-${timestamp}.csv`);
    
    const header = 'row_number;status;action;id_bbdd;defCodDea_nuevo;estrategia_match;similarity_score;candidates_count;csv_name;bbdd_field_matched;explicacion;error_message\n';
    const rows = this.reportRecords.map(r => 
      `${r.row_number};${r.status};${r.action};${r.id_bbdd};${r.defCodDea_nuevo};${r.estrategia_match};${r.similarity_score};${r.candidates_count};${this.escapeCsv(r.csv_name)};${r.bbdd_field_matched};${this.escapeCsv(r.explicacion)};${this.escapeCsv(r.error_message)}`
    ).join('\n');
    
    const csvContent = header + rows;
    
    fs.writeFileSync(this.csvReportPath, csvContent, 'utf8');
    
    console.log(`\n📄 CSV de reporte generado: ${this.csvReportPath}`);
    console.log(`   Total registros: ${this.reportRecords.length}`);
    console.log(`   Success: ${this.reportRecords.filter(r => r.status === 'success').length}`);
    console.log(`   Warning: ${this.reportRecords.filter(r => r.status === 'warning').length}`);
    console.log(`   Error: ${this.reportRecords.filter(r => r.status === 'error').length}`);
    console.log(`   Skipped: ${this.reportRecords.filter(r => r.status === 'skipped').length}`);
  }

  private escapeCsv(text: string): string {
    if (!text) return '';
    // Escapar comillas dobles y punto y coma
    return text.replace(/"/g, '""').replace(/;/g, ',');
  }

  private showDryRunReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 REPORTE DRY-RUN');
    console.log('='.repeat(60));
    
    const updates = this.dryRunRecords.filter(r => r.action === 'update');
    const inserts = this.dryRunRecords.filter(r => r.action === 'insert');
    
    if (updates.length > 0) {
      console.log(`\n✅ REGISTROS QUE SE ACTUALIZARÍAN (${updates.length} total):`);
      console.log('-'.repeat(60));
      
      const samplesToShow = this.verbose ? updates.length : Math.min(10, updates.length);
      for (let i = 0; i < samplesToShow; i++) {
        const rec = updates[i];
        console.log(`\n🔍 ID: ${rec.existingId} | ${rec.matchedBy}`);
        console.log(`   RM actual: ${rec.currentRmId || 'null'} → RM nuevo: ${rec.newRmId || 'null'}`);
        console.log(`   ${rec.explanation}`);
      }
      
      if (!this.verbose && updates.length > 10) {
        console.log(`\n... y ${updates.length - 10} registros más`);
      }
    }
    
    if (inserts.length > 0) {
      console.log(`\n➕ REGISTROS QUE SE INSERTARÍAN (${inserts.length} total):`);
      console.log('-'.repeat(60));
      
      const samplesToShow = this.verbose ? inserts.length : Math.min(10, inserts.length);
      for (let i = 0; i < samplesToShow; i++) {
        const rec = inserts[i];
        console.log(`\n✨ NUEVO | RM: ${rec.newRmId || 'null'}`);
        console.log(`   ${rec.explanation}`);
      }
      
      if (!this.verbose && inserts.length > 10) {
        console.log(`\n... y ${inserts.length - 10} registros más`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    const coordsExact = this.dryRunRecords.filter(r => r.matchedBy === 'coordinates_exact').length;
    const addressComplete = this.dryRunRecords.filter(r => r.matchedBy === 'address_complete').length;
    const coordsExtended = this.dryRunRecords.filter(r => r.matchedBy === 'coordinates_extended').length;
    const addressNoNumber = this.dryRunRecords.filter(r => r.matchedBy === 'address_no_number').length;
    const neighborhoodStreet = this.dryRunRecords.filter(r => r.matchedBy === 'neighborhood_street').length;
    const newRecords = this.dryRunRecords.filter(r => r.matchedBy === 'new').length;
    
    console.log('\n📊 ESTRATEGIAS DE MATCHING:');
    console.log(`📍 Coordenadas exactas: ${coordsExact}`);
    console.log(`📮 Dirección completa: ${addressComplete}`);
    console.log(`📍 Coordenadas ampliadas: ${coordsExtended}`);
    console.log(`📮 Dirección sin número: ${addressNoNumber}`);
    console.log(`🏘️  Barrio + vía: ${neighborhoodStreet}`);
    console.log(`✨ Registros nuevos: ${newRecords}`);
    console.log('='.repeat(60));
  }

  private showFinalStats(duration: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${this.dryRun ? 'RESUMEN DE OPERACIONES PROYECTADAS' : 'ESTADÍSTICAS FINALES'}`);
    console.log('='.repeat(60));
    console.log(`⏱️  Tiempo total: ${duration}s`);
    console.log(`📋 Total procesados: ${this.stats.totalProcessed}`);
    console.log(`✅ Registros actualizados: ${this.stats.updated}`);
    console.log(`➕ Registros insertados: ${this.stats.inserted}`);
    console.log(`⚠️  Registros saltados: ${this.stats.skipped}`);
    console.log(`❌ Errores: ${this.stats.errors}`);
    console.log('='.repeat(60));
  }

  private parseFloat(value: string): number | null {
    if (!value || value.trim() === '' || value === '\\N' || value === '.') return null;
    const cleanValue = value.replace(',', '.');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  }

  private parseInt(value: string): number | null {
    if (!value || value.trim() === '' || value === '\\N' || value === '.') return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

async function main() {
  const importer = new DeaFinalRevisionImporter();
  await importer.importDeas();
}

if (require.main === module) {
  main().catch(console.error);
}

export { DeaFinalRevisionImporter };
