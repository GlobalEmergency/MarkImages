/**
 * Ejecutor de todos los tests del sistema de geocodificación
 * Ejecuta todos los tests en secuencia y proporciona un resumen completo
 * 
 * Ejecutar con: npx tsx tests/run-all-tests.ts
 */

import { testChoperaValidation } from './chopera-validation.test';
import { testStreetNumberValidation } from './street-number-validation.test';
import { testAddressValidationSystem } from './address-validation.test';
import { testNewValidationSystem } from './validation-system.test';

async function runAllTests() {
  console.log('🚀 Ejecutando suite completa de tests del sistema de geocodificación\n');
  console.log('=' .repeat(80));
  
  const testSuites = [
    {
      name: 'Validación específica de Chopera',
      testFunction: testChoperaValidation,
      description: 'Tests específicos para problemas con "De la Chopera"'
    },
    {
      name: 'Validación de números de calle',
      testFunction: testStreetNumberValidation,
      description: 'Tests para discrepancias en números de calle'
    },
    {
      name: 'Sistema de validación general',
      testFunction: testAddressValidationSystem,
      description: 'Tests generales del sistema de validación'
    },
    {
      name: 'Sistema de validación integrado',
      testFunction: testNewValidationSystem,
      description: 'Tests de integración del sistema completo'
    }
  ];

  const results: { name: string; passed: boolean; error?: string }[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    
    console.log(`\n📋 Suite ${i + 1}/${testSuites.length}: ${suite.name}`);
    console.log(`📝 ${suite.description}`);
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const passed = await suite.testFunction() || false;
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results.push({ name: suite.name, passed });
      
      if (passed) {
        console.log(`✅ Suite completada exitosamente en ${duration}ms`);
        totalPassed++;
      } else {
        console.log(`❌ Suite falló en ${duration}ms`);
        totalFailed++;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`💥 Error ejecutando suite: ${errorMessage}`);
      results.push({ name: suite.name, passed: false, error: errorMessage });
      totalFailed++;
    }
    
    console.log('=' .repeat(80));
  }

  // Resumen final
  console.log('\n🎯 RESUMEN FINAL DE TODOS LOS TESTS');
  console.log('=' .repeat(80));
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`${index + 1}. ${result.name}: ${status}`);
    if (result.error) {
      console.log(`   💥 Error: ${result.error}`);
    }
  });
  
  console.log('-'.repeat(80));
  console.log(`📊 Suites exitosas: ${totalPassed}/${testSuites.length}`);
  console.log(`📊 Suites fallidas: ${totalFailed}/${testSuites.length}`);
  console.log(`📊 Porcentaje de éxito: ${((totalPassed / testSuites.length) * 100).toFixed(1)}%`);
  
  if (totalPassed === testSuites.length) {
    console.log('\n🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE!');
    console.log('✅ El sistema de geocodificación está funcionando correctamente');
    console.log('✅ Los casos problemáticos identificados están cubiertos');
    console.log('✅ El sistema está listo para mejoras basadas en los tests');
  } else {
    console.log('\n⚠️  ALGUNOS TESTS FALLARON');
    console.log('🔧 Se identificaron problemas que requieren corrección');
    console.log('📋 Revisar los resultados detallados arriba');
    
    // Sugerencias específicas basadas en qué tests fallaron
    console.log('\n💡 Sugerencias de corrección:');
    
    results.forEach(result => {
      if (!result.passed) {
        switch (result.name) {
          case 'Validación específica de Chopera':
            console.log('   🔧 Revisar normalización de nombres de vía con artículos');
            console.log('   🔧 Mejorar búsqueda fuzzy para "De la Chopera"');
            break;
          case 'Validación de números de calle':
            console.log('   🔧 Implementar penalización de confianza por discrepancia de números');
            console.log('   🔧 Mejorar ordenamiento de alternativas por proximidad numérica');
            break;
          case 'Sistema de validación general':
            console.log('   🔧 Revisar algoritmo general de confianza');
            console.log('   🔧 Mejorar generación de warnings y recomendaciones');
            break;
          case 'Sistema de validación integrado':
            console.log('   🔧 Revisar integración entre componentes del sistema');
            console.log('   🔧 Verificar flujo completo de validación');
            break;
        }
      }
    });
  }
  
  console.log('\n📚 Para ejecutar tests individuales:');
  console.log('   npx tsx tests/chopera-validation.test.ts');
  console.log('   npx tsx tests/street-number-validation.test.ts');
  console.log('   npx tsx tests/address-validation.test.ts');
  console.log('   npx tsx tests/validation-system.test.ts');
  
  // Exit code basado en resultados
  process.exit(totalFailed === 0 ? 0 : 1);
}

// Ejecutar si este archivo se ejecuta directamente
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Error crítico ejecutando suite de tests:', error);
    process.exit(1);
  });
}

export { runAllTests };
