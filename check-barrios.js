const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBarrios() {
  try {
    const direccionesConBarrio = await prisma.direccion.count({
      where: { barrioId: { not: null } }
    });
    
    const totalDirecciones = await prisma.direccion.count();
    
    console.log(`Direcciones con barrio asignado: ${direccionesConBarrio} de ${totalDirecciones} (${((direccionesConBarrio/totalDirecciones)*100).toFixed(1)}%)`);
    
    // Mostrar algunas direcciones de ejemplo
    const ejemplos = await prisma.direccion.findMany({
      take: 5,
      include: {
        barrio: true,
        distrito: true,
        via: true
      }
    });
    
    console.log('\nEjemplos de direcciones:');
    ejemplos.forEach((dir, i) => {
      console.log(`${i+1}. ${dir.via.claseVia} ${dir.via.nombre} ${dir.numero || ''}`);
      console.log(`   Distrito: ${dir.distrito.nombre}`);
      console.log(`   Barrio: ${dir.barrio?.nombre || 'SIN BARRIO'}`);
      console.log(`   Coordenadas: ${dir.latitud}, ${dir.longitud}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBarrios();
