import { newMadridValidationService } from '../src/services/newMadridValidationService';

/**
 * Test suite para el sistema de validación de direcciones
 * Ejecutar con: npx tsx tests/validation-system.test.ts
 */

async function testNewValidationSystem() {
  console.log('🧪 Probando el nuevo sistema de validación de direcciones...\n');

  const tests = [
    {
      name: 'Test 1: Dirección exacta',
      params: {
        streetType: 'CALLE',
        streetName: 'GRAN VIA',
        streetNumber: '1',
        postalCode: '28013',
        district: '1',
        coordinates: { latitude: 40.4200, longitude: -3.7025 }
      }
    },
    {
      name: 'Test 2: Búsqueda fuzzy',
      params: {
        streetType: 'CALLE',
        streetName: 'GRAN BIA', // Error tipográfico
        streetNumber: '1',
        postalCode: '28013',
        district: '1'
      }
    },
    {
      name: 'Test 3: Dirección no existente',
      params: {
        streetType: 'CALLE',
        streetName: 'INEXISTENTE',
        streetNumber: '999',
        postalCode: '99999',
        district: '99'
      }
    },
    {
      name: 'Test 4: Búsqueda geográfica',
      params: {
        streetType: 'PLAZA',
        streetName: 'MAYOR',
        streetNumber: undefined,
        postalCode: undefined,
        district: undefined,
        coordinates: { latitude: 40.4155, longitude: -3.7074 }
      }
    },
    {
      name: 'Test 5: Validación de componentes',
      params: {
        streetType: 'CALLE',
        streetName: 'ALCALA',
        streetNumber: '100',
        postalCode: '28009',
        district: '4'
      }
    },
    {
      name: 'Test 6: Caso problemático Chopera 4 → 2',
      params: {
        streetType: 'Paseo',
        streetName: 'De la Chopera',
        streetNumber: '4',
        postalCode: '28045',
        district: '2. Arganzuela',
        coordinates: { latitude: 40.395397, longitude: -3.701414 }
      }
    },
    {
      name: 'Test 7: Caso problemático Chopera 71 → múltiples alternativas',
      params: {
        streetType: 'Paseo',
        streetName: 'De la Chopera',
        streetNumber: '71',
        postalCode: '28045',
        district: '2. Arganzuela',
        coordinates: { latitude: 40.391872, longitude: -3.695722 }
      }
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    console.log(`📍 ${test.name}`);
    
    try {
      const result = await newMadridValidationService.validateAddress(
        test.params.streetType,
        test.params.streetName,
        test.params.streetNumber,
        test.params.postalCode,
        test.params.district,
        test.params.coordinates
      );

      // Validaciones básicas
      const isValid = 
        result !== undefined &&
        result.overallStatus !== undefined &&
        ['valid', 'needs_review', 'invalid'].includes(result.overallStatus) &&
        result.searchResult !== undefined &&
        result.searchResult.confidence >= 0 &&
        result.searchResult.confidence <= 1 &&
        Array.isArray(result.recommendedActions);

      if (isValid) {
        console.log('✅ Resultado:', {
          status: result.overallStatus,
          confidence: result.searchResult.confidence,
          matchType: result.searchResult.matchType,
          suggestions: result.searchResult.suggestions.length,
          actions: result.recommendedActions.slice(0, 2) // Solo mostrar las primeras 2 acciones
        });
        passedTests++;
      } else {
        console.log('❌ Test falló: Resultado inválido');
        console.log('Resultado recibido:', result);
      }

    } catch (error) {
      console.log('❌ Test falló con error:', error instanceof Error ? error.message : String(error));
    }

    console.log(''); // Línea en blanco
  }

  // Resumen final
  console.log('🎯 Resumen de pruebas:');
  console.log(`✅ Pruebas exitosas: ${passedTests}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
    process.exit(0);
  } else {
    console.log('⚠️  Algunas pruebas fallaron. Revisar la implementación.');
    process.exit(1);
  }
}

// Ejecutar tests si este archivo se ejecuta directamente
if (require.main === module) {
  testNewValidationSystem().catch(error => {
    console.error('💥 Error ejecutando tests:', error);
    process.exit(1);
  });
}

export { testNewValidationSystem };
