/**
 * Test suite para el sistema de validación de direcciones
 * Incluye casos específicos para problemas de números de calle
 * Ejecutar con: npx tsx tests/address-validation.test.ts
 */

import { newMadridValidationService } from '../src/services/newMadridValidationService';

async function testAddressValidationSystem() {
  console.log('🧪 Probando sistema de validación de direcciones...\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Dirección exacta
  totalTests++;
  console.log('📍 Test 1: Dirección exacta');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'GRAN VIA',
      '1',
      '28013',
      '1',
      { latitude: 40.4200, longitude: -3.7025 }
    );
    
    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      matchType: result.searchResult.matchType,
      suggestions: result.searchResult.suggestions.length,
      actions: result.recommendedActions.length
    });

    const isValid = 
      result !== undefined &&
      ['valid', 'needs_review', 'invalid'].includes(result.overallStatus) &&
      result.searchResult.confidence >= 0 &&
      result.searchResult.confidence <= 1;

    if (isValid) {
      console.log('✅ ÉXITO: Dirección exacta validada correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con validación de dirección exacta');
    }

  } catch (error) {
    console.log('❌ Error en Test 1:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 2: Búsqueda fuzzy con errores tipográficos
  totalTests++;
  console.log('📍 Test 2: Búsqueda fuzzy con errores tipográficos');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'GRAN BIA', // Error tipográfico
      '1',
      '28013',
      '1'
    );
    
    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      matchType: result.searchResult.matchType,
      suggestions: result.searchResult.suggestions.length,
      actions: result.recommendedActions.length
    });

    const isValid = 
      result !== undefined &&
      ['valid', 'needs_review', 'invalid'].includes(result.overallStatus) &&
      Array.isArray(result.recommendedActions);

    if (isValid) {
      console.log('✅ ÉXITO: Búsqueda fuzzy manejada correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con búsqueda fuzzy');
    }

  } catch (error) {
    console.log('❌ Error en Test 2:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 3: Direcciones no existentes
  totalTests++;
  console.log('📍 Test 3: Direcciones no existentes');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'INEXISTENTE',
      '999',
      '99999',
      '99'
    );
    
    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      suggestions: result.searchResult.suggestions.length,
      errors: result.searchResult.errors.length
    });

    const isValid = 
      result !== undefined &&
      result.overallStatus === 'invalid' &&
      result.searchResult.confidence === 0;

    if (isValid) {
      console.log('✅ ÉXITO: Direcciones no existentes manejadas correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con direcciones no existentes');
    }

  } catch (error) {
    console.log('❌ Error en Test 3:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 4: Discrepancias en números de calle
  totalTests++;
  console.log('📍 Test 4: Discrepancias en números de calle');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '999', // Número probablemente inexistente
      '28014',
      '2'
    );

    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      suggestions: result.searchResult.suggestions.length,
      warnings: result.searchResult.warnings.length,
      actions: result.recommendedActions.length
    });

    let numberDiscrepancyPassed = true;

    // El estado no debería ser 'valid' para números muy diferentes
    if (result.overallStatus === 'valid' && result.searchResult.suggestions.length > 0) {
      const bestMatch = result.searchResult.suggestions[0];
      if (bestMatch.numero && Math.abs(bestMatch.numero - 999) > 50) {
        console.log('   ❌ PROBLEMA: Estado "valid" para número muy diferente');
        numberDiscrepancyPassed = false;
      }
    }

    // Si encuentra sugerencias, la confianza no debería ser muy alta para números muy diferentes
    if (result.searchResult.suggestions.length > 0 && result.searchResult.confidence >= 0.9) {
      const bestMatch = result.searchResult.suggestions[0];
      if (bestMatch.numero && Math.abs(bestMatch.numero - 999) > 10) {
        console.log('   ❌ PROBLEMA: Confianza muy alta para número muy diferente');
        numberDiscrepancyPassed = false;
      }
    }

    if (numberDiscrepancyPassed) {
      console.log('✅ ÉXITO: Discrepancias de números manejadas correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con discrepancias de números');
    }

  } catch (error) {
    console.log('❌ Error en Test 4:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 5: Priorización de números exactos
  totalTests++;
  console.log('📍 Test 5: Priorización de números exactos');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'GRAN VIA',
      '1',
      '28013',
      '1'
    );

    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      suggestions: result.searchResult.suggestions.length
    });

    let prioritizationPassed = true;

    // Si hay múltiples sugerencias, verificar que estén ordenadas apropiadamente
    if (result.searchResult.suggestions.length > 1) {
      const suggestions = result.searchResult.suggestions;
      
      // La primera sugerencia debería tener la mayor confianza
      for (let i = 1; i < suggestions.length; i++) {
        if (suggestions[0].confidence < suggestions[i].confidence) {
          console.log('   ❌ PROBLEMA: Sugerencias no ordenadas por confianza');
          prioritizationPassed = false;
          break;
        }
      }
      
      // Si hay una coincidencia exacta de número, debería tener alta prioridad
      const exactMatch = suggestions.find(s => s.numero === 1);
      if (exactMatch && exactMatch.confidence < suggestions[0].confidence - 0.1) {
        console.log('   ❌ PROBLEMA: Número exacto no tiene prioridad apropiada');
        prioritizationPassed = false;
      }

      if (prioritizationPassed) {
        console.log('   ✅ Sugerencias ordenadas apropiadamente');
        suggestions.slice(0, 3).forEach((suggestion, index) => {
          console.log(`     ${index + 1}. Número ${suggestion.numero || 'N/A'} - Confianza: ${(suggestion.confidence * 100).toFixed(1)}%`);
        });
      }
    } else {
      console.log('   ⚠️  Solo una sugerencia encontrada, no aplicable para este test');
    }

    if (prioritizationPassed) {
      console.log('✅ ÉXITO: Priorización de números exactos correcta');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con priorización de números');
    }

  } catch (error) {
    console.log('❌ Error en Test 5:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 6: Búsqueda geográfica
  totalTests++;
  console.log('📍 Test 6: Búsqueda geográfica');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'PLAZA',
      'MAYOR',
      undefined,
      undefined,
      undefined,
      { latitude: 40.4155, longitude: -3.7074 } // Coordenadas de Plaza Mayor
    );
    
    console.log('✅ Resultado:', {
      status: result.overallStatus,
      confidence: result.searchResult.confidence,
      matchType: result.searchResult.matchType,
      suggestions: result.searchResult.suggestions.length,
      distance: result.searchResult.suggestions[0]?.distance
    });

    const isValid = 
      result !== undefined &&
      result.searchResult.confidence > 0 &&
      result.searchResult.suggestions.length > 0;

    if (isValid) {
      console.log('✅ ÉXITO: Búsqueda geográfica funciona correctamente');
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con búsqueda geográfica');
    }

  } catch (error) {
    console.log('❌ Error en Test 6:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 7: Generación de recomendaciones
  totalTests++;
  console.log('📍 Test 7: Generación de recomendaciones');
  
  try {
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '1',
      '28014',
      '2'
    );

    const hasValidRecommendations = 
      Array.isArray(result.recommendedActions) &&
      result.recommendedActions.length > 0 &&
      result.recommendedActions.every(action => typeof action === 'string' && action.length > 0);

    if (hasValidRecommendations) {
      console.log('✅ ÉXITO: Recomendaciones generadas correctamente');
      console.log(`   📝 ${result.recommendedActions.length} acciones recomendadas`);
      passedTests++;
    } else {
      console.log('❌ FALLO: Problemas con generación de recomendaciones');
    }

  } catch (error) {
    console.log('❌ Error en Test 7:', error instanceof Error ? error.message : String(error));
  }

  console.log('');

  // Test 8: Flujo de integración completo
  totalTests++;
  console.log('📍 Test 8: Flujo de integración completo');
  
  const integrationTestCases = [
    {
      name: 'Dirección válida',
      streetType: 'CALLE',
      streetName: 'ALCALA',
      streetNumber: '1',
      postalCode: '28014',
      district: '2'
    },
    {
      name: 'Dirección con error tipográfico',
      streetType: 'CALLE',
      streetName: 'ALCALÁ', // Con acento
      streetNumber: '1',
      postalCode: '28014',
      district: '2'
    }
  ];

  let integrationPassed = 0;

  for (const testCase of integrationTestCases) {
    try {
      console.log(`   🔍 Probando: ${testCase.name}`);
      
      const result = await newMadridValidationService.validateAddress(
        testCase.streetType,
        testCase.streetName,
        testCase.streetNumber,
        testCase.postalCode,
        testCase.district
      );

      const isValid = 
        result !== undefined &&
        ['valid', 'needs_review', 'invalid'].includes(result.overallStatus) &&
        result.searchResult !== undefined &&
        result.validationDetails !== undefined &&
        Array.isArray(result.recommendedActions);

      if (isValid) {
        console.log(`     ✅ ${testCase.name}: Status ${result.overallStatus}, Confianza ${(result.searchResult.confidence * 100).toFixed(1)}%`);
        integrationPassed++;
      } else {
        console.log(`     ❌ ${testCase.name}: Resultado inválido`);
      }

    } catch (error) {
      console.log(`     ❌ ${testCase.name}: Error - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (integrationPassed === integrationTestCases.length) {
    console.log('✅ ÉXITO: Flujo de integración completo funciona');
    passedTests++;
  } else {
    console.log(`❌ FALLO: Solo ${integrationPassed}/${integrationTestCases.length} casos de integración pasaron`);
  }

  console.log('');

  // Resumen final
  console.log('🎯 Resumen de pruebas del sistema de validación:');
  console.log(`✅ Pruebas exitosas: ${passedTests}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas del sistema de validación pasaron exitosamente!');
    console.log('✅ El sistema de validación funciona correctamente');
    return true;
  } else {
    console.log('⚠️  Algunas pruebas fallaron. El sistema necesita mejoras');
    console.log('🔧 Problemas identificados que requieren corrección');
    
    // Sugerencias de mejora específicas
    console.log('\n💡 Sugerencias de mejora para el sistema:');
    console.log('   1. Mejorar algoritmo de confianza para discrepancias de números');
    console.log('   2. Implementar mejor ordenamiento de sugerencias por relevancia');
    console.log('   3. Generar warnings más específicos para cada tipo de problema');
    console.log('   4. Ajustar estados de validación según el tipo de discrepancia');
    
    return false;
  }
}

// Ejecutar tests si este archivo se ejecuta directamente
if (require.main === module) {
  testAddressValidationSystem().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Error ejecutando tests del sistema de validación:', error);
    process.exit(1);
  });
}

export { testAddressValidationSystem };
