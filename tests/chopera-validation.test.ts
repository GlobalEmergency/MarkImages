/**
 * Test específico para verificar que el sistema maneja correctamente "De la Chopera"
 * Este test verifica un caso específico que causaba problemas en el frontend
 * donde "Paseo De la Chopera 4" no se encontraba correctamente.
 * 
 * Ejecutar con: npx tsx tests/chopera-validation.test.ts
 */

import { newMadridValidationService } from '../src/services/newMadridValidationService';

async function testChoperaValidation() {
  console.log('🧪 Probando validación específica de "De la Chopera"...\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Validación básica de "Paseo De la Chopera 4"
  totalTests++;
  console.log('📍 Test 1: Validación básica de "Paseo De la Chopera 4"');
  
  try {
    const testCase = {
      streetType: 'Paseo',
      streetName: 'De la Chopera',
      streetNumber: '4',
      postalCode: '28046',
      district: '2. Arganzuela',
      coordinates: {
        latitude: 40.385397,
        longitude: -3.721414
      }
    };

    const result = await newMadridValidationService.validateAddress(
      testCase.streetType,
      testCase.streetName,
      testCase.streetNumber,
      testCase.postalCode,
      testCase.district,
      testCase.coordinates
    );

    // Verificar que el sistema encuentra CHOPERA
    const hasChopera = result.searchResult.suggestions.some(suggestion => 
      suggestion.nombreViaAcentos.toUpperCase().includes('CHOPERA')
    );

    if (hasChopera && result.searchResult.suggestions.length > 0) {
      console.log('✅ ÉXITO: Sistema encontró CHOPERA');
      console.log('   - Sugerencias:', result.searchResult.suggestions.length);
      console.log('   - Confianza:', result.searchResult.confidence);
      console.log('   - Estado:', result.overallStatus);
      passedTests++;
    } else {
      console.log('❌ FALLO: No se encontró CHOPERA en las sugerencias');
      console.log('   - Sugerencias encontradas:', result.searchResult.suggestions.length);
    }

  } catch (error) {
    console.log('❌ Error en Test 1:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 2: Variaciones del nombre de la calle
  totalTests++;
  console.log('📍 Test 2: Variaciones del nombre "Chopera"');

  const variations = [
    'De la Chopera',
    'de la Chopera', 
    'DE LA CHOPERA',
    'Chopera'
  ];

  let variationsPassed = 0;

  for (const streetName of variations) {
    try {
      const result = await newMadridValidationService.validateAddress(
        'Paseo',
        streetName,
        '4',
        '28046',
        '2. Arganzuela',
        {
          latitude: 40.385397,
          longitude: -3.721414
        }
      );

      const hasChopera = result.searchResult.suggestions.some(suggestion => 
        suggestion.nombreViaAcentos.toUpperCase().includes('CHOPERA')
      );

      if (hasChopera) {
        console.log(`   ✅ "${streetName}" -> Encontrado`);
        variationsPassed++;
      } else {
        console.log(`   ❌ "${streetName}" -> No encontrado`);
      }

    } catch (error) {
      console.log(`   ❌ "${streetName}" -> Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (variationsPassed === variations.length) {
    console.log('✅ ÉXITO: Todas las variaciones funcionan');
    passedTests++;
  } else {
    console.log(`❌ FALLO: Solo ${variationsPassed}/${variations.length} variaciones funcionan`);
  }

  console.log('');

  // Test 3: Calidad de las sugerencias
  totalTests++;
  console.log('📍 Test 3: Calidad de las sugerencias');

  try {
    const result = await newMadridValidationService.validateAddress(
      'Paseo',
      'De la Chopera',
      '4',
      '28046',
      '2. Arganzuela',
      {
        latitude: 40.385397,
        longitude: -3.721414
      }
    );

    let qualityPassed = true;
    const suggestions = result.searchResult.suggestions;

    if (suggestions.length === 0) {
      console.log('❌ No hay sugerencias');
      qualityPassed = false;
    } else {
      // Verificar que las sugerencias tienen la información necesaria
      for (const suggestion of suggestions) {
        if (!suggestion.claseVia || !suggestion.nombreViaAcentos || 
            !suggestion.codigoPostal || !suggestion.distrito || 
            suggestion.confidence <= 0) {
          console.log('❌ Sugerencia incompleta:', suggestion);
          qualityPassed = false;
          break;
        }
      }

      if (qualityPassed) {
        console.log('✅ ÉXITO: Sugerencias tienen calidad adecuada');
        console.log(`   - ${suggestions.length} sugerencias válidas`);
        console.log(`   - Mejor confianza: ${suggestions[0]?.confidence.toFixed(3)}`);
        passedTests++;
      }
    }

  } catch (error) {
    console.log('❌ Error en Test 3:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Resumen final
  console.log('🎯 Resumen de pruebas de Chopera:');
  console.log(`✅ Pruebas exitosas: ${passedTests}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas de Chopera pasaron exitosamente!');
    console.log('✅ El sistema maneja correctamente "De la Chopera"');
    return true;
  } else {
    console.log('⚠️  Algunas pruebas fallaron. El sistema puede tener problemas con "De la Chopera"');
    return false;
  }
}

// Ejecutar tests si este archivo se ejecuta directamente
if (require.main === module) {
  testChoperaValidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Error ejecutando tests de Chopera:', error);
    process.exit(1);
  });
}

export { testChoperaValidation };
