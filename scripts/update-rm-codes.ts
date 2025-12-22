#!/usr/bin/env node
/**
 * Script para actualizar los códigos RM de los DEAs desde el CSV
 * 
 * Este script:
 * 1. Limpia todos los códigos existentes en la BD
 * 2. Lee el CSV por streaming (para evitar problemas de memoria con 6000+ registros)
 * 3. Actualiza el campo `code` de cada AED con el valor de `RM_ID` del CSV
 * 4. Procesa en lotes para optimizar el rendimiento
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/client/client';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

dotenv.config();
// Load .env.local
dotenv.config({ path: '.env.local', override: true });

const connectionString = process.env.DATABASE_URL || '';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface CsvRow {
  id: string;
  code?: string;
  provisional_number?: string;
  RM_ID?: string;
}

const CSV_PATH = path.join(__dirname, '../data/CSV/deas_completo_251221_3550_RM.csv');
const BATCH_SIZE = 100;
const PROGRESS_INTERVAL = 500;

async function main() {
  console.log('🚀 Iniciando actualización de códigos RM...\n');
  
  const startTime = Date.now();
  let totalProcessed = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  try {
    // 1. Limpiar todos los códigos existentes
    console.log('🧹 Limpiando códigos existentes...');
    const clearResult = await prisma.aed.updateMany({
      data: { code: null }
    });
    console.log(`✅ Limpiados ${clearResult.count} códigos\n`);

    // 2. Procesar CSV por streaming
    console.log('📖 Leyendo CSV y procesando...');
    console.log(`   Archivo: ${CSV_PATH}\n`);

    const records: CsvRow[] = [];
    let batchPromises: Promise<void>[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(parse({
          delimiter: ';',
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', async (row: CsvRow) => {
          totalProcessed++;

          // Validar que tengamos los datos necesarios
          if (!row.id) {
            skippedCount++;
            return;
          }

          const rmCode = row.RM_ID?.trim();
          
          // Si no hay RM_ID o está vacío, lo saltamos
          if (!rmCode || rmCode === '') {
            skippedCount++;
            return;
          }

          // Agregar a lote
          records.push(row);

          // Cuando alcancemos el tamaño del lote, procesarlo
          if (records.length >= BATCH_SIZE) {
            const batchToProcess = [...records];
            records.length = 0; // Limpiar array

            const batchPromise = processBatch(batchToProcess).then(result => {
              successCount += result.success;
              errorCount += result.errors;
              errors.push(...result.errorDetails);
            });

            batchPromises.push(batchPromise);

            // Mostrar progreso
            if (totalProcessed % PROGRESS_INTERVAL === 0) {
              console.log(`   Procesados: ${totalProcessed} | Exitosos: ${successCount} | Errores: ${errorCount} | Saltados: ${skippedCount}`);
            }
          }
        })
        .on('end', async () => {
          // Procesar registros restantes
          if (records.length > 0) {
            const result = await processBatch(records);
            successCount += result.success;
            errorCount += result.errors;
            errors.push(...result.errorDetails);
          }

          // Esperar a que terminen todos los lotes
          await Promise.all(batchPromises);
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // 3. Reporte final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(60));
    console.log(`⏱️  Tiempo total: ${duration}s`);
    console.log(`📊 Total procesados: ${totalProcessed}`);
    console.log(`✅ Actualizados correctamente: ${successCount}`);
    console.log(`⚠️  Saltados (sin RM_ID): ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Detalles de errores:');
      errors.slice(0, 10).forEach(err => {
        console.log(`   - ID ${err.id}: ${err.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... y ${errors.length - 10} errores más`);
      }
    }

    // 4. Verificación final
    console.log('\n🔍 Verificación final...');
    const withCode = await prisma.aed.count({ where: { code: { not: null } } });
    const withoutCode = await prisma.aed.count({ where: { code: null } });
    console.log(`   DEAs con código: ${withCode}`);
    console.log(`   DEAs sin código: ${withoutCode}`);

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function processBatch(rows: CsvRow[]): Promise<{
  success: number;
  errors: number;
  errorDetails: Array<{ id: string; error: string }>;
}> {
  let success = 0;
  let errors = 0;
  const errorDetails: Array<{ id: string; error: string }> = [];

  const promises = rows.map(async (row) => {
    try {
      const rmCode = row.RM_ID?.trim();
      if (!rmCode || rmCode === '') {
        return;
      }

      // Buscar por provisional_number en lugar de por ID
      const provisionalNum = row.provisional_number ? parseInt(row.provisional_number) : null;
      
      if (provisionalNum === null || isNaN(provisionalNum)) {
        errors++;
        errorDetails.push({ 
          id: row.id, 
          error: `Número provisional inválido: ${row.provisional_number}` 
        });
        return;
      }

      // Encontrar el AED por provisional_number
      const aed = await prisma.aed.findFirst({
        where: { provisional_number: provisionalNum },
        select: { id: true }
      });

      if (!aed) {
        errors++;
        errorDetails.push({ 
          id: row.id, 
          error: `No se encontró AED con provisional_number: ${provisionalNum}` 
        });
        return;
      }

      // Actualizar con el código RM
      await prisma.aed.update({
        where: { id: aed.id },
        data: { code: rmCode }
      });
      
      success++;
    } catch (error) {
      errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorDetails.push({ id: row.id, error: errorMessage });
    }
  });

  await Promise.all(promises);

  return { success, errors, errorDetails };
}

// Ejecutar script
main()
  .then(() => {
    console.log('\n✅ Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando script:', error);
    process.exit(1);
  });
