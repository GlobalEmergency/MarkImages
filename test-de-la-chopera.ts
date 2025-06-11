/**
 * Test específico para verificar que el sistema maneja correctamente "De la Chopera"
 * como aparece en el frontend
 */

import { newMadridValidationService } from './src/services/newMadridValidationService';

async function testDelaChopera() {
  console.log('🧪 Probando "De la Chopera" como aparece en el frontend...\n');

  // Datos exactos como aparecen en el frontend
  const testCase = {
    streetType: 'Paseo',
    streetName: 'De la Chopera', // Nombre completo con "De la"
    streetNumber: '4',
    postalCode: '28046', // Código postal incorrecto
    district: '2. Arganzuela',
    coordinates: {
      latitude: 40.385397,
      longitude: -3.721414
    }
  };

  console.log('📋 Datos exactos del frontend:');
  console.log(testCase);
  console.log('\n');

  try {
    const result = await newMadridValidationService.validateAddress(
      testCase.streetType,
      testCase.streetName,
      testCase.streetNumber,
      testCase.postalCode,
      testCase.district,
      testCase.coordinates
    );

    console.log('📊 Resultado de validación:');
    console.log('Status:', result.overallStatus);
    console.log('Confianza:', result.searchResult.confidence);
    console.log('Tipo de coincidencia:', result.searchResult.matchType);
    console.log('Válido:', result.searchResult.isValid);
    console.log('\nSugerencias encontradas:');
    
    if (result.searchResult.suggestions.length > 0) {
      result.searchResult.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.claseVia} ${suggestion.nombreViaAcentos} ${suggestion.numero || 'S/N'}`);
        console.log(`      CP: ${suggestion.codigoPostal}, Distrito: ${suggestion.distrito}, Confianza: ${suggestion.confidence.toFixed(3)}`);
        console.log(`      Tipo: ${suggestion.matchType}, Distancia: ${suggestion.distance ? Math.round(suggestion.distance) + 'm' : 'N/A'}`);
      });
    } else {
      console.log('   No se encontraron sugerencias');
    }

    console.log('\nWarnings:');
    result.searchResult.warnings.forEach(warning => {
      console.log(`   ⚠️  ${warning}`);
    });

    console.log('\nErrores:');
    result.searchResult.errors.forEach(error => {
      console.log(`   ❌ ${error}`);
    });

    console.log('\nAcciones recomendadas:');
    result.recommendedActions.forEach(action => {
      console.log(`   - ${action}`);
    });

    // Verificar si encontró CHOPERA
    const hasChopera = result.searchResult.suggestions.some(s => 
      s.nombreViaAcentos.toUpperCase().includes('CHOPERA')
    );
    
    if (hasChopera) {
      console.log('\n✅ ÉXITO: Sistema encontró CHOPERA con "De la Chopera"');
      console.log('✅ El frontend debería mostrar la dirección oficial encontrada');
      return true;
    } else {
      console.log('\n❌ PROBLEMA: No se encontró CHOPERA con "De la Chopera"');
      console.log('❌ El frontend mostrará "No se encontró dirección oficial"');
      return false;
    }

  } catch (error) {
    console.log('❌ Error en la validación:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Ejecutar el test
testDelaChopera().then(success => {
  if (success) {
    console.log('\n🎉 Test exitoso: El sistema maneja correctamente "De la Chopera"');
    process.exit(0);
  } else {
    console.log('\n💥 Test fallido: El sistema no encuentra "De la Chopera"');
    console.log('💡 Esto explica por qué el frontend muestra "No se encontró dirección oficial"');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Error ejecutando test:', error);
  process.exit(1);
});
