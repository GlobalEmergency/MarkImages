// Check raw coordinate data format
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRawCoordinates() {
  console.log('🔍 Checking raw coordinate data...');
  
  try {
    // Get a few sample addresses to see the raw data
    const sampleAddresses = await prisma.madridAddress.findMany({
      take: 5
    });
    
    console.log('📋 Sample addresses (raw data):');
    sampleAddresses.forEach((addr, index) => {
      console.log(`\n   ${index + 1}. ${addr.viaClase || addr.viaPar} ${addr.viaNombreAcentos || addr.viaNombre} ${addr.numero || ''}`);
      console.log(`      latitud: ${addr.latitud} (type: ${typeof addr.latitud})`);
      console.log(`      longitud: ${addr.longitud} (type: ${typeof addr.longitud})`);
      console.log(`      utmxEd: ${addr.utmxEd}`);
      console.log(`      utmyEd: ${addr.utmyEd}`);
      console.log(`      utmxEtrs: ${addr.utmxEtrs}`);
      console.log(`      utmyEtrs: ${addr.utmyEtrs}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking raw data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRawCoordinates();
