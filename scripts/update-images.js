const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuración de tamaños de imagen tipo móvil (al menos 2000px en una dimensión)
// Solo formatos horizontales y verticales, NO cuadrados
const IMAGE_SIZES = [
  // Formatos verticales (Portrait - típicos de móvil)
  { width: 1500, height: 2000 },  // Portrait estándar
  { width: 1600, height: 2400 },  // Portrait alto
  { width: 1200, height: 2000 },  // Portrait estrecho
  { width: 1440, height: 2560 },  // Portrait móvil moderno
  { width: 1080, height: 2340 },  // Portrait móvil 19.5:9
  { width: 1125, height: 2436 },  // Portrait iPhone X/11/12
  
  // Formatos horizontales (Landscape - móvil girado)
  { width: 2000, height: 1500 },  // Landscape estándar
  { width: 2400, height: 1600 },  // Landscape ancho
  { width: 2000, height: 1200 },  // Landscape ultra ancho
  { width: 2560, height: 1440 },  // Landscape widescreen
  { width: 2340, height: 1080 },  // Landscape móvil 19.5:9
  { width: 2436, height: 1125 },  // Landscape iPhone X/11/12
];

// Lista de IDs específicos de Picsum para diferentes tipos de imágenes
const SPECIFIC_IMAGE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  40, 42, 43, 48, 49, 50, 52, 54, 55, 56,
  57, 58, 59, 60, 62, 63, 64, 65, 67, 68,
  69, 70, 72, 74, 75, 76, 77, 78, 82, 83,
  84, 85, 86, 88, 89, 90, 91, 92, 96, 97,
  100, 101, 102, 103, 104, 106, 107, 108, 109, 110,
  111, 112, 113, 114, 116, 117, 118, 119, 120, 121,
  122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
  133, 134, 135, 136, 137, 139, 140, 141, 142, 143,
  144, 145, 146, 147, 149, 152, 153, 154, 155, 156,
  158, 159, 160, 161, 162, 163, 164, 165, 169, 170,
  171, 172, 173, 174, 175, 176, 177, 178, 180, 181,
  182, 183, 184, 188, 189, 190, 191, 192, 193, 195,
  196, 197, 198, 199, 200, 201, 202, 203, 204, 206,
  208, 209, 210, 211, 212, 213, 214, 215, 216, 217,
  218, 219, 220, 221, 222, 224, 225, 227, 230, 231,
  232, 233, 234, 235, 236, 237, 238, 239, 240, 241,
  242, 243, 244, 247, 249, 250, 251, 252, 253, 254,
  255, 256, 257, 258, 259, 260, 261, 262, 263, 264,
  265, 266, 267, 268, 269, 270, 271, 272, 274, 275,
  276, 277, 278, 279, 280, 281, 282, 283, 284, 285,
  286, 287, 288, 289, 290, 291, 292, 293, 295, 296,
  297, 298, 299, 300, 301, 302, 303, 304, 305, 306,
  307, 308, 309, 310, 311, 312, 313, 314, 315, 316,
  317, 318, 319, 320, 321, 322, 323, 324, 325, 326,
  327, 328, 329, 330, 331, 332, 333, 334, 335, 336,
  337, 338, 339, 340, 341, 342, 343, 344, 345, 346,
  347, 348, 349, 350, 351, 352, 353, 354, 355, 356,
  357, 358, 359, 360, 361, 362, 363, 364, 365, 366,
  367, 368, 369, 370, 371, 372, 373, 374, 375, 376,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  387, 388, 389, 390, 391, 392, 393, 394, 395, 396,
  397, 398, 399, 400
];

/**
 * Genera una URL de imagen usando Picsum Photos
 */
function generateImageUrl(seed, imageType = 'random') {
  // Seleccionar tamaño aleatorio
  const size = IMAGE_SIZES[Math.floor(Math.random() * IMAGE_SIZES.length)];
  
  if (imageType === 'specific') {
    // Usar ID específico de imagen
    const imageId = SPECIFIC_IMAGE_IDS[Math.floor(Math.random() * SPECIFIC_IMAGE_IDS.length)];
    return `https://picsum.photos/id/${imageId}/${size.width}/${size.height}`;
  } else {
    // Usar seed para imagen aleatoria pero consistente
    return `https://picsum.photos/seed/${seed}/${size.width}/${size.height}`;
  }
}

/**
 * Genera un seed único basado en el ID del DEA y el tipo de foto
 */
function generateSeed(deaId, photoType) {
  return `dea-${deaId}-${photoType}-${Date.now()}`;
}

/**
 * Actualiza las URLs de las imágenes para todos los registros DEA
 */
async function updateDeaImages() {
  try {
    console.log('🚀 Iniciando actualización de imágenes DEA...');
    
    // Obtener todos los registros DEA
    const deaRecords = await prisma.deaRecord.findMany({
      select: {
        id: true,
        foto1: true,
        foto2: true,
        numeroProvisionalDea: true
      }
    });

    console.log(`📊 Encontrados ${deaRecords.length} registros DEA para actualizar`);

    let updatedCount = 0;
    const batchSize = 10; // Procesar en lotes para evitar sobrecarga

    for (let i = 0; i < deaRecords.length; i += batchSize) {
      const batch = deaRecords.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (dea) => {
        // Generar seeds únicos para cada foto
        const seed1 = generateSeed(dea.id, 'foto1');
        const seed2 = generateSeed(dea.id, 'foto2');
        
        // Decidir aleatoriamente si usar imágenes específicas o con seed
        const useSpecificForFoto1 = Math.random() > 0.5;
        const useSpecificForFoto2 = Math.random() > 0.5;
        
        // Generar URLs
        const foto1Url = generateImageUrl(
          seed1, 
          useSpecificForFoto1 ? 'specific' : 'random'
        );
        const foto2Url = generateImageUrl(
          seed2, 
          useSpecificForFoto2 ? 'specific' : 'random'
        );

        // Actualizar el registro
        await prisma.deaRecord.update({
          where: { id: dea.id },
          data: {
            foto1: foto1Url,
            foto2: foto2Url
          }
        });

        console.log(`✅ DEA ${dea.numeroProvisionalDea} (ID: ${dea.id}) actualizado:`);
        console.log(`   📸 Foto1: ${foto1Url}`);
        console.log(`   📸 Foto2: ${foto2Url}`);
        
        return dea.id;
      });

      // Esperar a que se complete el lote actual
      await Promise.all(updatePromises);
      updatedCount += batch.length;
      
      console.log(`📈 Progreso: ${updatedCount}/${deaRecords.length} registros actualizados`);
      
      // Pequeña pausa entre lotes para no sobrecargar la base de datos
      if (i + batchSize < deaRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('🎉 ¡Actualización completada exitosamente!');
    console.log(`📊 Total de registros actualizados: ${updatedCount}`);
    
    // Mostrar algunas estadísticas
    const sampleRecords = await prisma.deaRecord.findMany({
      take: 5,
      select: {
        id: true,
        numeroProvisionalDea: true,
        foto1: true,
        foto2: true
      }
    });

    console.log('\n📋 Muestra de registros actualizados:');
    sampleRecords.forEach(record => {
      console.log(`DEA ${record.numeroProvisionalDea}:`);
      console.log(`  Foto1: ${record.foto1}`);
      console.log(`  Foto2: ${record.foto2}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error durante la actualización:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Función para actualizar solo registros específicos (opcional)
 */
async function updateSpecificDeaImages(deaIds) {
  try {
    console.log(`🎯 Actualizando imágenes para DEAs específicos: ${deaIds.join(', ')}`);
    
    for (const deaId of deaIds) {
      const seed1 = generateSeed(deaId, 'foto1');
      const seed2 = generateSeed(deaId, 'foto2');
      
      const useSpecificForFoto1 = Math.random() > 0.5;
      const useSpecificForFoto2 = Math.random() > 0.5;
      
      const foto1Url = generateImageUrl(
        seed1, 
        useSpecificForFoto1 ? 'specific' : 'random'
      );
      const foto2Url = generateImageUrl(
        seed2, 
        useSpecificForFoto2 ? 'specific' : 'random'
      );

      await prisma.deaRecord.update({
        where: { id: deaId },
        data: {
          foto1: foto1Url,
          foto2: foto2Url
        }
      });

      console.log(`✅ DEA ID ${deaId} actualizado:`);
      console.log(`   📸 Foto1: ${foto1Url}`);
      console.log(`   📸 Foto2: ${foto2Url}`);
    }

    console.log('🎉 Actualización específica completada!');
  } catch (error) {
    console.error('❌ Error durante la actualización específica:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--specific') {
    // Modo específico: actualizar solo ciertos IDs
    const ids = args.slice(1).map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ids.length > 0) {
      updateSpecificDeaImages(ids);
    } else {
      console.error('❌ Por favor proporciona IDs válidos después de --specific');
      process.exit(1);
    }
  } else {
    // Modo normal: actualizar todos los registros
    updateDeaImages();
  }
}

module.exports = { updateDeaImages, updateSpecificDeaImages, generateImageUrl, generateSeed };
