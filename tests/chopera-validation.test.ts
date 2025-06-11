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

  // Test 4: Caso problemático - Paseo De la Chopera 4 → Sistema devuelve 2
  totalTests++;
  console.log('📍 Test 4: Caso problemático - Número 4 vs 2 (confianza inflada)');

  try {
    const result = await newMadridValidationService.validateAddress(
      'Paseo',
      'De la Chopera',
      '4',
      '28045',
      '2. Arganzuela',
      {
        latitude: 40.395397,
        longitude: -3.701414
      }
    );

    let problemDetected = false;
    const bestMatch = result.searchResult.suggestions[0];

    // Verificar si el sistema devuelve un número diferente con alta confianza
    if (bestMatch && bestMatch.numero && bestMatch.numero !== 4) {
      console.log(`   ⚠️  Sistema devuelve número ${bestMatch.numero} en lugar de 4`);
      
      // La confianza NO debería ser 100% cuando hay discrepancia de números
      if (result.searchResult.confidence >= 0.95) {
        console.log(`   ❌ PROBLEMA: Confianza demasiado alta (${(result.searchResult.confidence * 100).toFixed(1)}%) para número incorrecto`);
        problemDetected = true;
      } else {
        console.log(`   ✅ Confianza apropiada (${(result.searchResult.confidence * 100).toFixed(1)}%) para número incorrecto`);
      }

      // Debería haber warnings sobre la discrepancia
      const hasNumberWarning = result.searchResult.warnings.some(warning => 
        warning.toLowerCase().includes('número') || warning.toLowerCase().includes('numero')
      );
      
      if (!hasNumberWarning) {
        console.log('   ❌ PROBLEMA: No hay warning sobre discrepancia de números');
        problemDetected = true;
      } else {
        console.log('   ✅ Warning apropiado sobre discrepancia de números');
      }

      // El estado debería ser 'needs_review' no 'valid'
      if (result.overallStatus === 'valid') {
        console.log('   ❌ PROBLEMA: Estado "valid" cuando debería ser "needs_review"');
        problemDetected = true;
      } else {
        console.log(`   ✅ Estado apropiado: ${result.overallStatus}`);
      }
    }

    if (!problemDetected) {
      console.log('✅ ÉXITO: Sistema maneja apropiadamente la discrepancia de números');
      passedTests++;
    } else {
      console.log('❌ FALLO: Sistema tiene problemas con validación de números');
    }

  } catch (error) {
    console.log('❌ Error en Test 4:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 5: Caso problemático - Paseo De la Chopera 71 → Múltiples alternativas con 100% confianza
  totalTests++;
  console.log('📍 Test 5: Caso problemático - Múltiples alternativas con confianza inflada');

  try {
    const result = await newMadridValidationService.validateAddress(
      'Paseo',
      'De la Chopera',
      '71',
      '28045',
      '2. Arganzuela',
      {
        latitude: 40.391872,
        longitude: -3.695722
      }
    );

    let problemDetected = false;
    const suggestions = result.searchResult.suggestions;

    if (suggestions.length > 1) {
      console.log(`   📊 Encontradas ${suggestions.length} alternativas`);
      
      // Verificar si todas las alternativas tienen confianza muy alta
      const highConfidenceCount = suggestions.filter(s => s.confidence >= 0.95).length;
      
      if (highConfidenceCount === suggestions.length && suggestions.length > 1) {
        console.log(`   ❌ PROBLEMA: Todas las ${suggestions.length} alternativas tienen confianza ≥95%`);
        problemDetected = true;
        
        // Mostrar las alternativas problemáticas
        suggestions.forEach((suggestion, index) => {
          console.log(`     ${index + 1}. Número ${suggestion.numero || 'N/A'} - Confianza: ${(suggestion.confidence * 100).toFixed(1)}%`);
        });
      } else {
        console.log('   ✅ Confianzas diferenciadas apropiadamente');
      }

      // El número exacto (71) debería tener mayor confianza que números cercanos
      const exactMatch = suggestions.find(s => s.numero === 71);
      const otherNumbers = suggestions.filter(s => s.numero !== 71);
      
      if (exactMatch && otherNumbers.length > 0) {
        const hasHigherConfidence = otherNumbers.every(other => exactMatch.confidence > other.confidence);
        
        if (!hasHigherConfidence) {
          console.log('   ❌ PROBLEMA: Número exacto (71) no tiene mayor confianza que alternativas');
          problemDetected = true;
        } else {
          console.log('   ✅ Número exacto tiene mayor confianza que alternativas');
        }
      }

      // Debería identificar necesidad de revisión cuando hay múltiples opciones similares
      if (result.overallStatus === 'valid' && suggestions.length > 2) {
        console.log('   ❌ PROBLEMA: Estado "valid" con múltiples alternativas similares');
        problemDetected = true;
      } else {
        console.log(`   ✅ Estado apropiado: ${result.overallStatus}`);
      }
    }

    if (!problemDetected) {
      console.log('✅ ÉXITO: Sistema maneja apropiadamente múltiples alternativas');
      passedTests++;
    } else {
      console.log('❌ FALLO: Sistema tiene problemas con múltiples alternativas');
    }

  } catch (error) {
    console.log('❌ Error en Test 5:', error instanceof Error ? error.message : String(error));
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
    console.log('🔧 Problemas identificados que requieren corrección en el algoritmo de confianza');
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
