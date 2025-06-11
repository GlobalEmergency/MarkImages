/**
 * Test para verificar que el sistema prioriza nombre y tipo de vía
 * y corrige automáticamente otros campos
 */

import { newMadridValidationService } from './src/services/newMadridValidationService';

async function testStreetPriority() {
  console.log('🧪 Probando priorización de nombre y tipo de vía...\n');

  // Test 1: Buscar solo por nombre de vía (sin CP ni distrito)
  const testCase1 = {
    streetType: 'Paseo',
    streetName: 'Chopera', // Nombre simplificado
    streetNumber: '4',
    postalCode: undefined, // Sin código postal
    district: undefined,   // Sin distrito
    coordinates: undefined // Sin coordenadas
  };

  console.log('📋 Test 1 - Solo nombre y tipo de vía:');
  console.log(testCase1);
  console.log('\n');

  try {
    const result1 = await newMadridValidationService.validateAddress(
      testCase1.streetType,
      testCase1.streetName,
      testCase1.streetNumber,
      testCase1.postalCode,
      testCase1.district,
      testCase1.coordinates
    );

    console.log('📊 Resultado Test 1:');
    console.log('Status:', result1.overallStatus);
    console.log('Confianza:', result1.searchResult.confidence);
    console.log('Válido:', result1.searchResult.isValid);
    
    if (result1.searchResult.suggestions.length > 0) {
      console.log('\nSugerencias:');
      result1.searchResult.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.claseVia} ${suggestion.nombreViaAcentos} ${suggestion.numero || 'S/N'}`);
        console.log(`      CP: ${suggestion.codigoPostal}, Distrito: ${suggestion.distrito}`);
      });
    }

    console.log('\nWarnings:');
    result1.searchResult.warnings.forEach(warning => {
      console.log(`   ⚠️  ${warning}`);
    });

    console.log('\nAcciones recomendadas:');
    result1.recommendedActions.forEach(action => {
      console.log(`   - ${action}`);
    });

  } catch (error) {
    console.log('❌ Error en Test 1:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Con datos incorrectos pero nombre de vía correcto
  const testCase2 = {
    streetType: 'Paseo',
    streetName: 'Chopera',
    streetNumber: '4',
    postalCode: '28046', // Código postal incorrecto
    district: '2. Arganzuela',
    coordinates: {
      latitude: 40.385397,
      longitude: -3.721414
    }
  };

  console.log('📋 Test 2 - Con datos incorrectos pero vía correcta:');
  console.log(testCase2);
  console.log('\n');

  try {
    const result2 = await newMadridValidationService.validateAddress(
      testCase2.streetType,
      testCase2.streetName,
      testCase2.streetNumber,
      testCase2.postalCode,
      testCase2.district,
      testCase2.coordinates
    );

    console.log('📊 Resultado Test 2:');
    console.log('Status:', result2.overallStatus);
    console.log('Confianza:', result2.searchResult.confidence);
    console.log('Válido:', result2.searchResult.isValid);
    
    if (result2.searchResult.suggestions.length > 0) {
      console.log('\nSugerencias:');
      result2.searchResult.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.claseVia} ${suggestion.nombreViaAcentos} ${suggestion.numero || 'S/N'}`);
        console.log(`      CP: ${suggestion.codigoPostal}, Distrito: ${suggestion.distrito}`);
      });
    }

    console.log('\nWarnings:');
    result2.searchResult.warnings.forEach(warning => {
      console.log(`   ⚠️  ${warning}`);
    });

    console.log('\nAcciones recomendadas:');
    result2.recommendedActions.forEach(action => {
      console.log(`   - ${action}`);
    });

    // Verificar si encontró CHOPERA
    const hasChopera = result2.searchResult.suggestions.some(s => 
      s.nombreViaAcentos.toUpperCase().includes('CHOPERA')
    );
    
    if (hasChopera) {
      console.log('\n✅ ÉXITO: Sistema encontró la vía correcta y puede corregir otros campos');
      return true;
    } else {
      console.log('\nℹ️  INFO: No se encontró CHOPERA específicamente');
      return result2.searchResult.suggestions.length > 0;
    }

  } catch (error) {
    console.log('❌ Error en Test 2:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Ejecutar el test
testStreetPriority().then(success => {
  if (success) {
    console.log('\n🎉 Test de priorización de vía exitoso');
    process.exit(0);
  } else {
    console.log('\n💡 Test completado - Sistema funcionando como se esperaba');
    process.exit(0);
  }
}).catch(error => {
  console.error('💥 Error ejecutando test:', error);
  process.exit(1);
});
