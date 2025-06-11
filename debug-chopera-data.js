/**
 * Script para verificar qué datos de CHOPERA tenemos en la base de datos
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugChoperaData() {
  console.log('🔍 Buscando datos de CHOPERA en la base de datos...\n');

  try {
    // Buscar todas las variantes de CHOPERA
    const choperaResults = await prisma.optimizedMadridAddress.findMany({
      where: {
        OR: [
          { nombreViaAcentos: { contains: 'CHOPERA', mode: 'insensitive' } },
          { nombreVia: { contains: 'CHOPERA', mode: 'insensitive' } },
          { nombreViaAcentos: { contains: 'Chopera', mode: 'insensitive' } },
          { nombreVia: { contains: 'Chopera', mode: 'insensitive' } }
        ]
      },
      take: 10
    });

    console.log(`📊 Encontrados ${choperaResults.length} registros con CHOPERA:`);
    
    choperaResults.forEach((record, index) => {
      console.log(`\n${index + 1}. ${record.claseVia} ${record.nombreViaAcentos} ${record.numero || 'S/N'}`);
      console.log(`   nombreVia: "${record.nombreVia}"`);
      console.log(`   nombreViaAcentos: "${record.nombreViaAcentos}"`);
      console.log(`   CP: ${record.codigoPostal}, Distrito: ${record.distrito}`);
      console.log(`   Coordenadas: ${record.latitud}, ${record.longitud}`);
    });

    // Buscar específicamente PASEO CHOPERA
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Buscando específicamente PASEO CHOPERA...\n');

    const paseoChopera = await prisma.optimizedMadridAddress.findMany({
      where: {
        AND: [
          { claseVia: { contains: 'PASEO', mode: 'insensitive' } },
          { 
            OR: [
              { nombreViaAcentos: { contains: 'CHOPERA', mode: 'insensitive' } },
              { nombreVia: { contains: 'CHOPERA', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    console.log(`📊 Encontrados ${paseoChopera.length} registros de PASEO CHOPERA:`);
    
    paseoChopera.forEach((record, index) => {
      console.log(`\n${index + 1}. ${record.claseVia} ${record.nombreViaAcentos} ${record.numero || 'S/N'}`);
      console.log(`   nombreVia: "${record.nombreVia}"`);
      console.log(`   nombreViaAcentos: "${record.nombreViaAcentos}"`);
      console.log(`   CP: ${record.codigoPostal}, Distrito: ${record.distrito}`);
      console.log(`   Coordenadas: ${record.latitud}, ${record.longitud}`);
    });

    // Buscar variantes con "DE LA"
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Buscando variantes con "DE LA"...\n');

    const delaVariants = await prisma.optimizedMadridAddress.findMany({
      where: {
        OR: [
          { nombreViaAcentos: { contains: 'DE LA CHOPERA', mode: 'insensitive' } },
          { nombreVia: { contains: 'DE LA CHOPERA', mode: 'insensitive' } },
          { nombreViaAcentos: { contains: 'DE LA', mode: 'insensitive' } }
        ]
      },
      take: 5
    });

    console.log(`📊 Encontrados ${delaVariants.length} registros con "DE LA":`);
    
    delaVariants.forEach((record, index) => {
      console.log(`\n${index + 1}. ${record.claseVia} ${record.nombreViaAcentos} ${record.numero || 'S/N'}`);
      console.log(`   nombreVia: "${record.nombreVia}"`);
      console.log(`   nombreViaAcentos: "${record.nombreViaAcentos}"`);
    });

  } catch (error) {
    console.error('❌ Error consultando base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugChoperaData();
