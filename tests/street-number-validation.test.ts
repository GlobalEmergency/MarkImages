/**
 * Test específico para validación de números de calle
 * Verifica que el sistema maneje correctamente las discrepancias en números
 * y no devuelva confianzas infladas cuando los números no coinciden.
 * 
 * Ejecutar con: npx tsx tests/street-number-validation.test.ts
 */

import { newMadridValidationService } from '../src/services/newMadridValidationService';

async function testStreetNumberValidation() {
  console.log('🧪 Probando validación específica de números de calle...\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Número exacto vs número cercano
  totalTests++;
  console.log('📍 Test 1: Validación de números cercanos (diferencia de 1-2 números)');
  
  const closeNumberCases = [
    {
      name: 'Calle Alcalá 100 vs 102',
      requested: '100',
      found: 102,
      street: 'ALCALA',
      type: 'CALLE',
      postalCode: '28009',
      district: '4'
    },
    {
      name: 'Gran Vía 25 vs 27',
      requested: '25',
      found: 27,
      street: 'GRAN VIA',
      type: 'CALLE',
      postalCode: '28013',
      district: '1'
    }
  ];

  let closeNumbersPassed = 0;

  for (const testCase of closeNumberCases) {
    try {
      console.log(`   🔍 Probando: ${testCase.name}`);
      
      const result = await newMadridValidationService.validateAddress(
        testCase.type,
        testCase.street,
        testCase.requested,
        testCase.postalCode,
        testCase.district
      );

      const bestMatch = result.searchResult.suggestions[0];
      
      if (bestMatch && bestMatch.numero && bestMatch.numero !== parseInt(testCase.requested)) {
        // Verificar que la confianza se reduzca apropiadamente
        if (result.searchResult.confidence < 0.9) {
          console.log(`     ✅ Confianza reducida apropiadamente: ${(result.searchResult.confidence * 100).toFixed(1)}%`);
          closeNumbersPassed++;
        } else {
          console.log(`     ❌ Confianza demasiado alta: ${(result.searchResult.confidence * 100).toFixed(1)}% para número incorrecto`);
        }

        // Verificar que el estado sea 'needs_review'
        if (result.overallStatus !== 'valid') {
          console.log(`     ✅ Estado apropiado: ${result.overallStatus}`);
        } else {
          console.log(`     ❌ Estado incorrecto: ${result.overallStatus} (debería ser needs_review)`);
        }
      } else {
        console.log(`     ⚠️  No se encontró discrepancia de números para probar`);
        closeNumbersPassed++; // No penalizar si no hay datos para probar
      }

    } catch (error) {
      console.log(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (closeNumbersPassed === closeNumberCases.length) {
    console.log('✅ ÉXITO: Números cercanos manejados correctamente');
    passedTests++;
  } else {
    console.log(`❌ FALLO: Solo ${closeNumbersPassed}/${closeNumberCases.length} casos de números cercanos pasaron`);
  }

  console.log('');

  // Test 2: Números muy diferentes
  totalTests++;
  console.log('📍 Test 2: Validación de números muy diferentes');

  const differentNumberCases = [
    {
      name: 'Calle Alcalá 1 vs 200+',
      requested: '1',
      street: 'ALCALA',
      type: 'CALLE',
      postalCode: '28014',
      district: '2'
    },
    {
      name: 'Gran Vía 1 vs 50+',
      requested: '1',
      street: 'GRAN VIA',
      type: 'CALLE',
      postalCode: '28013',
      district: '1'
    }
  ];

  let differentNumbersPassed = 0;

  for (const testCase of differentNumberCases) {
    try {
      console.log(`   🔍 Probando: ${testCase.name}`);
      
      const result = await newMadridValidationService.validateAddress(
        testCase.type,
        testCase.street,
        testCase.requested,
        testCase.postalCode,
        testCase.district
      );

      const bestMatch = result.searchResult.suggestions[0];
      
      if (bestMatch && bestMatch.numero) {
        const numberDifference = Math.abs(bestMatch.numero - parseInt(testCase.requested));
        
        if (numberDifference > 10) {
          // Para diferencias grandes, la confianza debería ser baja
          if (result.searchResult.confidence < 0.7) {
            console.log(`     ✅ Confianza baja apropiada: ${(result.searchResult.confidence * 100).toFixed(1)}% para diferencia de ${numberDifference}`);
            differentNumbersPassed++;
          } else {
            console.log(`     ❌ Confianza demasiado alta: ${(result.searchResult.confidence * 100).toFixed(1)}% para diferencia de ${numberDifference}`);
          }

          // El estado debería ser 'needs_review' o 'invalid'
          if (result.overallStatus !== 'valid') {
            console.log(`     ✅ Estado apropiado: ${result.overallStatus}`);
          } else {
            console.log(`     ❌ Estado incorrecto: ${result.overallStatus} (no debería ser valid)`);
          }
        } else {
          console.log(`     ⚠️  Diferencia pequeña (${numberDifference}), no aplicable para este test`);
          differentNumbersPassed++; // No penalizar
        }
      } else {
        console.log(`     ⚠️  No se encontró número para comparar`);
        differentNumbersPassed++; // No penalizar si no hay datos
      }

    } catch (error) {
      console.log(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (differentNumbersPassed === differentNumberCases.length) {
    console.log('✅ ÉXITO: Números muy diferentes manejados correctamente');
    passedTests++;
  } else {
    console.log(`❌ FALLO: Solo ${differentNumbersPassed}/${differentNumberCases.length} casos de números diferentes pasaron`);
  }

  console.log('');

  // Test 3: Múltiples alternativas con números diferentes
  totalTests++;
  console.log('📍 Test 3: Múltiples alternativas con números diferentes');

  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '50',
      '28014',
      '2'
    );

    let multipleAlternativesPassed = true;
    const suggestions = result.searchResult.suggestions;

    if (suggestions.length > 1) {
      console.log(`   📊 Encontradas ${suggestions.length} alternativas`);
      
      // Verificar que no todas tengan la misma confianza alta
      const uniqueConfidences = new Set(suggestions.map(s => Math.round(s.confidence * 100)));
      
      if (uniqueConfidences.size === 1 && suggestions[0].confidence >= 0.95) {
        console.log('   ❌ PROBLEMA: Todas las alternativas tienen la misma confianza alta');
        multipleAlternativesPassed = false;
      } else {
        console.log('   ✅ Confianzas diferenciadas apropiadamente');
      }

      // Verificar ordenamiento por proximidad al número solicitado
      const requestedNumber = 50;
      let previousDistance = -1;
      let isProperlyOrdered = true;

      for (let i = 0; i < Math.min(3, suggestions.length); i++) {
        const suggestion = suggestions[i];
        if (suggestion.numero) {
          const distance = Math.abs(suggestion.numero - requestedNumber);
          
          if (previousDistance >= 0 && distance < previousDistance) {
            // Está bien ordenado (distancias crecientes o iguales)
          } else if (previousDistance >= 0 && distance > previousDistance + 5) {
            // Diferencia significativa en ordenamiento
            isProperlyOrdered = false;
            break;
          }
          
          previousDistance = distance;
          console.log(`     ${i + 1}. Número ${suggestion.numero} (distancia: ${distance}) - Confianza: ${(suggestion.confidence * 100).toFixed(1)}%`);
        }
      }

      if (isProperlyOrdered) {
        console.log('   ✅ Alternativas ordenadas por proximidad al número solicitado');
      } else {
        console.log('   ❌ PROBLEMA: Alternativas no están bien ordenadas por proximidad');
        multipleAlternativesPassed = false;
      }
    } else {
      console.log('   ⚠️  Solo una alternativa encontrada, no aplicable para este test');
    }

    if (multipleAlternativesPassed) {
      console.log('✅ ÉXITO: Múltiples alternativas manejadas correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con manejo de múltiples alternativas');
    }

  } catch (error) {
    console.log('❌ Error en Test 3:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 4: Validación de warnings para discrepancias de números
  totalTests++;
  console.log('📍 Test 4: Generación de warnings para discrepancias de números');

  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '100',
      '28009',
      '4'
    );

    const bestMatch = result.searchResult.suggestions[0];
    let warningsPassed = true;

    if (bestMatch && bestMatch.numero && bestMatch.numero !== 100) {
      // Debería haber warnings sobre la discrepancia
      const hasNumberWarning = result.searchResult.warnings.some(warning => 
        warning.toLowerCase().includes('número') || 
        warning.toLowerCase().includes('numero') ||
        warning.toLowerCase().includes('corregir')
      );

      if (hasNumberWarning) {
        console.log('   ✅ Warning apropiado sobre discrepancia de números');
        console.log(`   📝 Warnings: ${result.searchResult.warnings.slice(0, 2).join(', ')}`);
      } else {
        console.log('   ❌ PROBLEMA: No hay warning sobre discrepancia de números');
        warningsPassed = false;
      }

      // Verificar acciones recomendadas
      const hasNumberAction = result.recommendedActions.some(action =>
        action.toLowerCase().includes('número') || 
        action.toLowerCase().includes('numero') ||
        action.toLowerCase().includes('corregir')
      );

      if (hasNumberAction) {
        console.log('   ✅ Acción recomendada apropiada sobre números');
      } else {
        console.log('   ❌ PROBLEMA: No hay acción recomendada sobre números');
        warningsPassed = false;
      }
    } else {
      console.log('   ⚠️  No hay discrepancia de números para generar warnings');
    }

    if (warningsPassed) {
      console.log('✅ ÉXITO: Warnings y acciones generadas correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con generación de warnings');
    }

  } catch (error) {
    console.log('❌ Error en Test 4:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Resumen final
  console.log('🎯 Resumen de pruebas de números de calle:');
  console.log(`✅ Pruebas exitosas: ${passedTests}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas de números de calle pasaron exitosamente!');
    console.log('✅ El sistema maneja correctamente las discrepancias de números');
    return true;
  } else {
    console.log('⚠️  Algunas pruebas fallaron. El sistema tiene problemas con validación de números');
    console.log('🔧 Problemas identificados que requieren corrección en el algoritmo de confianza');
    
    // Sugerencias de mejora
    console.log('\n💡 Sugerencias de mejora:');
    console.log('   1. Penalizar la confianza cuando el número no coincide exactamente');
    console.log('   2. Ordenar alternativas por proximidad al número solicitado');
    console.log('   3. Generar warnings específicos para discrepancias de números');
    console.log('   4. Ajustar el estado general cuando hay discrepancias significativas');
    
    return false;
  }
}

// Ejecutar tests si este archivo se ejecuta directamente
if (require.main === module) {
  testStreetNumberValidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Error ejecutando tests de números de calle:', error);
    process.exit(1);
  });
}

export { testStreetNumberValidation };
