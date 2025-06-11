/**
 * Script para debuggear el problema específico de "Paseo De la Chopera 4"
 * que está devolviendo "OPORTO" como coincidencia del 98.8%
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugChoperaIssue() {
  console.log('🔍 Debugging: Paseo De la Chopera 4 -> OPORTO issue\n');

  // Datos originales del problema
  const originalData = {
    streetType: 'Paseo',
    streetName: 'De la Chopera',
    streetNumber: '4',
    postalCode: '28046',
    district: '2. Arganzuela',
    coordinates: {
      lat: 40.385397,
      lng: -3.721414
    }
  };

  console.log('📋 Datos originales:');
  console.log(originalData);
  console.log('\n');

  // 1. Verificar si existe "Paseo De la Chopera" en la BD
  console.log('1️⃣ Buscando "Paseo De la Chopera" en la base de datos...');
  
  try {
    const choperaResults = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.via_id,
        v.codigo_via,
        v.clase_via,
        v.nombre as via_nombre,
        v.nombre_con_acentos as via_nombre_acentos,
        d.numero,
        d.codigo_postal,
        dist.codigo_distrito as distrito,
        dist.nombre as distrito_nombre,
        d.latitud,
        d.longitud
      FROM direcciones d
      JOIN vias v ON d.via_id = v.id
      JOIN distritos dist ON d.distrito_id = dist.id
      WHERE v.nombre_con_acentos ILIKE '%chopera%'
      ORDER BY d.numero ASC
      LIMIT 10
    `;

    console.log(`✅ Encontradas ${choperaResults.length} direcciones con "chopera":`);
    choperaResults.forEach(result => {
      console.log(`   - ${result.clase_via} ${result.via_nombre_acentos} ${result.numero || 'S/N'} (CP: ${result.codigo_postal}, Distrito: ${result.distrito})`);
    });
    console.log('\n');

  } catch (error) {
    console.log('❌ Error buscando Chopera:', error.message);
  }

  // 2. Verificar por qué aparece "OPORTO"
  console.log('2️⃣ Investigando por qué aparece "OPORTO"...');
  
  try {
    const oportoResults = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.via_id,
        v.codigo_via,
        v.clase_via,
        v.nombre as via_nombre,
        v.nombre_con_acentos as via_nombre_acentos,
        d.numero,
        d.codigo_postal,
        dist.codigo_distrito as distrito,
        dist.nombre as distrito_nombre,
        d.latitud,
        d.longitud,
        similarity(v.nombre_normalizado, 'de la chopera') as similarity_score
      FROM direcciones d
      JOIN vias v ON d.via_id = v.id
      JOIN distritos dist ON d.distrito_id = dist.id
      WHERE v.nombre_con_acentos ILIKE '%oporto%'
      ORDER BY similarity_score DESC
      LIMIT 5
    `;

    console.log(`✅ Encontradas ${oportoResults.length} direcciones con "oporto":`);
    oportoResults.forEach(result => {
      console.log(`   - ${result.clase_via} ${result.via_nombre_acentos} ${result.numero || 'S/N'} (CP: ${result.codigo_postal}, Distrito: ${result.distrito})`);
      console.log(`     Similitud: ${result.similarity_score}, Coords: ${result.latitud}, ${result.longitud}`);
    });
    console.log('\n');

  } catch (error) {
    console.log('❌ Error buscando OPORTO:', error.message);
  }

  // 3. Probar búsqueda fuzzy con diferentes términos
  console.log('3️⃣ Probando búsqueda fuzzy...');
  
  const searchTerms = [
    'de la chopera',
    'chopera',
    'paseo de la chopera',
    'oporto'
  ];

  for (const term of searchTerms) {
    try {
      const fuzzyResults = await prisma.$queryRaw`
        SELECT 
          v.nombre as via_nombre,
          v.nombre_con_acentos as via_nombre_acentos,
          v.clase_via,
          similarity(v.nombre_normalizado, ${term.toLowerCase()}) as similarity_score
        FROM vias v
        WHERE similarity(v.nombre_normalizado, ${term.toLowerCase()}) >= 0.3
        ORDER BY similarity_score DESC
        LIMIT 5
      `;

      console.log(`🔍 Búsqueda fuzzy para "${term}":`);
      fuzzyResults.forEach(result => {
        console.log(`   - ${result.clase_via} ${result.via_nombre_acentos} (Similitud: ${result.similarity_score})`);
      });
      console.log('');

    } catch (error) {
      console.log(`❌ Error en búsqueda fuzzy para "${term}":`, error.message);
    }
  }

  // 4. Búsqueda geográfica cerca de las coordenadas originales
  console.log('4️⃣ Búsqueda geográfica cerca de las coordenadas originales...');
  
  try {
    const geoResults = await prisma.$queryRaw`
      SELECT 
        d.id,
        v.clase_via,
        v.nombre_con_acentos as via_nombre_acentos,
        d.numero,
        d.codigo_postal,
        dist.codigo_distrito as distrito,
        d.latitud,
        d.longitud,
        (
          6371 * acos(
            cos(radians(${originalData.coordinates.lat})) * 
            cos(radians(d.latitud)) * 
            cos(radians(d.longitud) - radians(${originalData.coordinates.lng})) + 
            sin(radians(${originalData.coordinates.lat})) * 
            sin(radians(d.latitud))
          )
        ) * 1000 AS distance_meters
      FROM direcciones d
      JOIN vias v ON d.via_id = v.id
      JOIN distritos dist ON d.distrito_id = dist.id
      WHERE (
        6371 * acos(
          cos(radians(${originalData.coordinates.lat})) * 
          cos(radians(d.latitud)) * 
          cos(radians(d.longitud) - radians(${originalData.coordinates.lng})) + 
          sin(radians(${originalData.coordinates.lat})) * 
          sin(radians(d.latitud))
        )
      ) <= 1
      ORDER BY distance_meters ASC
      LIMIT 10
    `;

    console.log(`✅ Direcciones dentro de 1km de las coordenadas originales:`);
    geoResults.forEach(result => {
      console.log(`   - ${result.clase_via} ${result.via_nombre_acentos} ${result.numero || 'S/N'} (${Math.round(result.distance_meters)}m)`);
      console.log(`     CP: ${result.codigo_postal}, Distrito: ${result.distrito}`);
    });
    console.log('\n');

  } catch (error) {
    console.log('❌ Error en búsqueda geográfica:', error.message);
  }

  // 5. Simular el proceso completo de validación
  console.log('5️⃣ Simulando proceso completo de validación...');
  
  try {
    // Importar el servicio de validación
    const { newMadridValidationService } = require('./src/services/newMadridValidationService.ts');
    
    const validationResult = await newMadridValidationService.validateAddress(
      originalData.streetType,
      originalData.streetName,
      originalData.streetNumber,
      originalData.postalCode,
      originalData.district,
      originalData.coordinates
    );

    console.log('📊 Resultado de validación completa:');
    console.log('Status:', validationResult.overallStatus);
    console.log('Confianza:', validationResult.searchResult.confidence);
    console.log('Tipo de coincidencia:', validationResult.searchResult.matchType);
    console.log('Sugerencias:');
    
    validationResult.searchResult.suggestions.slice(0, 3).forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.claseVia} ${suggestion.nombreViaAcentos} ${suggestion.numero || 'S/N'}`);
      console.log(`      CP: ${suggestion.codigoPostal}, Distrito: ${suggestion.distrito}, Confianza: ${suggestion.confidence}`);
    });

    console.log('\nAcciones recomendadas:');
    validationResult.recommendedActions.forEach(action => {
      console.log(`   - ${action}`);
    });

  } catch (error) {
    console.log('❌ Error en validación completa:', error.message);
  }

  await prisma.$disconnect();
}

// Ejecutar el debugging
debugChoperaIssue().catch(error => {
  console.error('💥 Error en debugging:', error);
  process.exit(1);
});
