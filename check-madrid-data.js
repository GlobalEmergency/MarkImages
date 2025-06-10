// Check Madrid data and coordinates
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMadridData() {
  console.log('🔍 Checking Madrid address data...');
  
  try {
    // Count total addresses
    const totalAddresses = await prisma.madridAddress.count();
    console.log(`📊 Total Madrid addresses: ${totalAddresses}`);
    
    // Count addresses with coordinates
    const addressesWithCoords = await prisma.madridAddress.count({
      where: {
        AND: [
          { latitud: { not: null } },
          { longitud: { not: null } }
        ]
      }
    });
    console.log(`📍 Addresses with coordinates: ${addressesWithCoords}`);
    
    // Sample some addresses with coordinates
    if (addressesWithCoords > 0) {
      const sampleAddresses = await prisma.madridAddress.findMany({
        where: {
          AND: [
            { latitud: { not: null } },
            { longitud: { not: null } }
          ]
        },
        take: 3
      });
      
      console.log('\n📋 Sample addresses with coordinates:');
      sampleAddresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. ${addr.viaClase || addr.viaPar} ${addr.viaNombreAcentos || addr.viaNombre} ${addr.numero || ''}`);
        console.log(`      Coordinates: ${addr.latitud}, ${addr.longitud}`);
        console.log(`      District: ${addr.distrito}, Postal Code: ${addr.codPostal}`);
      });
    }
    
    // Check if there are any addresses without coordinates
    const addressesWithoutCoords = await prisma.madridAddress.count({
      where: {
        OR: [
          { latitud: null },
          { longitud: null }
        ]
      }
    });
    console.log(`\n⚠️ Addresses without coordinates: ${addressesWithoutCoords}`);
    
  } catch (error) {
    console.error('❌ Error checking Madrid data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMadridData();
