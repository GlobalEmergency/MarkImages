#!/usr/bin/env ts-node

/**
 * Script auxiliar para ejecutar la importación de DEAs con merge
 * 
 * Uso:
 *   npx ts-node scripts/run-dea-final-revision-import.ts           # Modo normal
 *   npx ts-node scripts/run-dea-final-revision-import.ts --dry-run # Simulación
 *   npx ts-node scripts/run-dea-final-revision-import.ts --dry-run --verbose # Simulación detallada
 */

import { DeaFinalRevisionImporter } from './import-dea-final-revision';

async function main() {
  // Parsear argumentos de línea de comandos
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  IMPORTACIÓN DE DEAs - REVISIÓN FINAL CON MERGE           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso:');
    console.log('  npx ts-node scripts/run-dea-final-revision-import.ts [opciones]\n');
    console.log('Opciones:');
    console.log('  --dry-run    Simula la importación sin modificar la base de datos');
    console.log('  --verbose    Muestra información detallada de todas las operaciones');
    console.log('  --help, -h   Muestra esta ayuda\n');
    console.log('Ejemplos:');
    console.log('  # Ejecutar importación real');
    console.log('  npx ts-node scripts/run-dea-final-revision-import.ts\n');
    console.log('  # Simular para ver qué cambiaría');
    console.log('  npx ts-node scripts/run-dea-final-revision-import.ts --dry-run\n');
    console.log('  # Simular con detalles completos');
    console.log('  npx ts-node scripts/run-dea-final-revision-import.ts --dry-run --verbose\n');
    process.exit(0);
  }
  
  const importer = new DeaFinalRevisionImporter({ dryRun, verbose });
  await importer.importDeas();
}

main().catch((error) => {
  console.error('\n❌ Error fatal durante la importación:', error);
  process.exit(1);
});
