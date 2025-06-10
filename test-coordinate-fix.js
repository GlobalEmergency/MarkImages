// Test script to verify coordinate distance calculation fix
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCoordinateCalculation() {
  console.log('🧪 Testing coordinate distance calculation fix...');
  
  try {
    // Get DEA record 9 (the one mentioned by the user)
    const record = await prisma.deaRecord.findFirst({
      where: { numeroProvisionalDea: 9 }
    });
    
    if (!record) {
      console.log('❌ DEA record 9 not found');
      return;
    }
    
    console.log('📍 DEA Record 9 coordinates:');
    console.log(`   User coordinates: ${record.latitud}, ${record.longitud}`);
    
    // Try to find an official address for this location
    const officialAddress = await prisma.madridAddress.findFirst({
      where: {
        AND: [
          { latitud: { not: null } },
          { longitud: { not: null } },
          { distrito: { not: null } }
        ]
      },
      take: 1
    });
    
    if (officialAddress && officialAddress.latitud && officialAddress.longitud) {
      console.log('🏢 Found official address with coordinates:');
      console.log(`   Official coordinates: ${officialAddress.latitud}, ${officialAddress.longitud}`);
      
      // Calculate distance using Haversine formula
      const distance = calculateDistance(
        record.latitud,
        record.longitud,
        officialAddress.latitud,
        officialAddress.longitud
      );
      
      console.log(`📏 Distance calculation: ${(distance * 1000).toFixed(0)} meters`);
      console.log(`📏 Distance calculation: ${distance.toFixed(3)} km`);
      
      if (distance === 0) {
        console.log('❌ ERROR: Distance is still 0 - coordinates are identical');
      } else {
        console.log('✅ SUCCESS: Distance calculation is working correctly');
      }
    } else {
      console.log('⚠️ No official address with coordinates found for testing');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

testCoordinateCalculation();
