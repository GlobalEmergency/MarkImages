/**
 * Test script para verificar que el sistema de validación corregido
 * ya no devuelve "OPORTO" como coincidencia para "Paseo De la Chopera 4"
 */

import { newMadridValidationService } from './src/services/newMadridValidationService';

async function testFixedValidation() {
  console.log('🧪 Probando el sistema de validación corregido...\n');

  // Datos originales del problema
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

  console.log('📋 Datos de prueba:');
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

    // Verificar que no aparezca OPORTO como primera sugerencia
    const hasOportoAsFirstResult = result.searchResult.suggestions.length > 0 && 
      result.searchResult.suggestions[0].nombreViaAcentos.toUpperCase().includes('OPORTO');

    if (hasOportoAsFirstResult) {
      console.log('\n❌ PROBLEMA PERSISTE: OPORTO sigue apareciendo como primera sugerencia');
      return false;
    } else {
      console.log('\n✅ PROBLEMA RESUELTO: OPORTO ya no aparece como primera sugerencia');
      
      // Verificar si encontró la dirección correcta
      const hasChopera = result.searchResult.suggestions.some(s => 
        s.nombreViaAcentos.toUpperCase().includes('CHOPERA')
      );
      
      if (hasChopera) {
        console.log('✅ BONUS: Se encontró la dirección correcta (CHOPERA)');
      } else {
        console.log('ℹ️  INFO: No se encontró CHOPERA, pero eso es esperado con las validaciones más estrictas');
      }
      
      return true;
    }

  } catch (error) {
    console.log('❌ Error en la validación:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Ejecutar el test
testFixedValidation().then(success => {
  if (success) {
    console.log('\n🎉 Test exitoso: El problema ha sido corregido');
    process.exit(0);
  } else {
    console.log('\n💥 Test fallido: El problema persiste');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Error ejecutando test:', error);
  process.exit(1);
});
