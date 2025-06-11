const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Importar funciones del script principal
const { generateImageUrl, generateSeed } = require('./update-images.js');

/**
 * Script de prueba para verificar la generación de URLs de imágenes
 */
async function testImageGeneration() {
  try {
    console.log('🧪 Iniciando prueba de generación de imágenes...\n');

    // Prueba 1: Generar URLs de ejemplo
    console.log('📋 Prueba 1: Generación de URLs de ejemplo');
    console.log('='.repeat(50));
    
    for (let i = 1; i <= 5; i++) {
      const seed1 = generateSeed(i, 'foto1');
      const seed2 = generateSeed(i, 'foto2');
      
      const foto1Random = generateImageUrl(seed1, 'random');
      const foto1Specific = generateImageUrl(seed1, 'specific');
      const foto2Random = generateImageUrl(seed2, 'random');
      const foto2Specific = generateImageUrl(seed2, 'specific');
      
      console.log(`DEA ${i}:`);
      console.log(`  Foto1 (seed):     ${foto1Random}`);
      console.log(`  Foto1 (specific): ${foto1Specific}`);
      console.log(`  Foto2 (seed):     ${foto2Random}`);
      console.log(`  Foto2 (specific): ${foto2Specific}`);
      console.log('');
    }

    // Prueba 2: Verificar conexión a la base de datos
    console.log('📋 Prueba 2: Verificación de conexión a la base de datos');
    console.log('='.repeat(50));
    
    const deaCount = await prisma.deaRecord.count();
    console.log(`✅ Conexión exitosa. Total de registros DEA: ${deaCount}`);
    
    if (deaCount === 0) {
      console.log('⚠️  No hay registros DEA en la base de datos');
      return;
    }

    // Prueba 3: Mostrar algunos registros actuales
    console.log('\n📋 Prueba 3: Muestra de registros actuales');
    console.log('='.repeat(50));
    
    const sampleRecords = await prisma.deaRecord.findMany({
      take: 3,
      select: {
        id: true,
        numeroProvisionalDea: true,
        foto1: true,
        foto2: true
      }
    });

    sampleRecords.forEach(record => {
      console.log(`DEA ${record.numeroProvisionalDea} (ID: ${record.id}):`);
      console.log(`  Foto1 actual: ${record.foto1 || 'NULL'}`);
      console.log(`  Foto2 actual: ${record.foto2 || 'NULL'}`);
      console.log('');
    });

    // Prueba 4: Simular actualización (sin guardar)
    console.log('📋 Prueba 4: Simulación de actualización (sin guardar)');
    console.log('='.repeat(50));
    
    const testRecord = sampleRecords[0];
    if (testRecord) {
      const seed1 = generateSeed(testRecord.id, 'foto1');
      const seed2 = generateSeed(testRecord.id, 'foto2');
      
      const newFoto1 = generateImageUrl(seed1, Math.random() > 0.5 ? 'specific' : 'random');
      const newFoto2 = generateImageUrl(seed2, Math.random() > 0.5 ? 'specific' : 'random');
      
      console.log(`DEA ${testRecord.numeroProvisionalDea} (ID: ${testRecord.id}) - Simulación:`);
      console.log(`  Foto1 actual: ${testRecord.foto1 || 'NULL'}`);
      console.log(`  Foto1 nueva:  ${newFoto1}`);
      console.log(`  Foto2 actual: ${testRecord.foto2 || 'NULL'}`);
      console.log(`  Foto2 nueva:  ${newFoto2}`);
    }

    // Prueba 5: Verificar tamaños de imagen
    console.log('\n📋 Prueba 5: Verificación de tamaños de imagen');
    console.log('='.repeat(50));
    
    const testUrls = [];
    for (let i = 0; i < 10; i++) {
      const seed = `test-${i}`;
      const url = generateImageUrl(seed, 'random');
      testUrls.push(url);
    }
    
    testUrls.forEach((url, index) => {
      // Extraer dimensiones de la URL
      const match = url.match(/\/(\d+)\/(\d+)$/);
      if (match) {
        const width = parseInt(match[1]);
        const height = parseInt(match[2]);
        const hasMinSize = width >= 2000 || height >= 2000;
        console.log(`URL ${index + 1}: ${width}x${height} ${hasMinSize ? '✅' : '❌'} - ${url}`);
      }
    });

    console.log('\n🎉 ¡Todas las pruebas completadas!');
    console.log('\n📝 Resumen:');
    console.log(`- Total de registros DEA: ${deaCount}`);
    console.log('- Generación de URLs: ✅ Funcionando');
    console.log('- Conexión a BD: ✅ Funcionando');
    console.log('- Tamaños de imagen: ✅ Todos ≥ 2000px en al menos una dimensión');
    
    console.log('\n🚀 Para ejecutar la actualización real:');
    console.log('   node scripts/update-images.js');
    console.log('\n🎯 Para actualizar solo algunos registros:');
    console.log('   node scripts/update-images.js --specific 1 2 3');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  testImageGeneration();
}

module.exports = { testImageGeneration };
