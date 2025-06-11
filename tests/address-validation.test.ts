import { newMadridValidationService } from '../src/services/newMadridValidationService';

describe('Address Validation System', () => {
  
  test('should validate exact address match', async () => {
    console.log('📍 Test 1: Dirección exacta');
    
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
      actions: result.recommendedActions
    });

    expect(result).toBeDefined();
    expect(result.overallStatus).toMatch(/valid|needs_review|invalid/);
    expect(result.searchResult.confidence).toBeGreaterThanOrEqual(0);
    expect(result.searchResult.confidence).toBeLessThanOrEqual(1);
  });

  test('should handle fuzzy search with typos', async () => {
    console.log('\n📍 Test 2: Búsqueda fuzzy');
    
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
      actions: result.recommendedActions
    });

    expect(result).toBeDefined();
    expect(result.overallStatus).toMatch(/valid|needs_review|invalid/);
    expect(result.recommendedActions).toBeInstanceOf(Array);
  });

  test('should handle non-existent addresses', async () => {
    console.log('\n📍 Test 3: Dirección no existente');
    
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
      matchType: result.searchResult.matchType,
      suggestions: result.searchResult.suggestions.length,
      errors: result.searchResult.errors,
      actions: result.recommendedActions
    });

    expect(result).toBeDefined();
    expect(result.overallStatus).toBe('invalid');
    expect(result.searchResult.confidence).toBe(0);
  });

  test('should perform geographic search', async () => {
    console.log('\n📍 Test 4: Búsqueda geográfica');
    
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
      distance: result.searchResult.suggestions[0]?.distance,
      actions: result.recommendedActions
    });

    expect(result).toBeDefined();
    expect(result.searchResult.confidence).toBeGreaterThan(0);
    expect(result.searchResult.suggestions.length).toBeGreaterThan(0);
  });

  test('should validate address components', async () => {
    console.log('\n📍 Test 5: Validación de componentes');
    
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '100',
      '28009',
      '4'
    );

    expect(result.addressValidation).toBeDefined();
    expect(result.addressValidation.streetTypeValidation).toBeDefined();
    expect(result.addressValidation.streetNameValidation).toBeDefined();
    expect(result.addressValidation.postalCodeValidation).toBeDefined();
    expect(result.addressValidation.districtValidation).toBeDefined();
  });

  test('should generate appropriate recommendations', async () => {
    console.log('\n📍 Test 6: Generación de recomendaciones');
    
    const result = await newMadridValidationService.validateAddress(
      'CALLE',
      'ALCALA',
      '1',
      '28014',
      '2'
    );

    expect(result.recommendedActions).toBeInstanceOf(Array);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
    
    // Verificar que las acciones son strings válidos
    result.recommendedActions.forEach(action => {
      expect(typeof action).toBe('string');
      expect(action.length).toBeGreaterThan(0);
    });
  });

});

// Test de integración para verificar que el sistema completo funciona
describe('Integration Tests', () => {
  
  test('should handle complete validation workflow', async () => {
    console.log('\n🔄 Test de integración: Flujo completo');
    
    const testCases = [
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

    for (const testCase of testCases) {
      console.log(`\n  → Probando: ${testCase.name}`);
      
      const result = await newMadridValidationService.validateAddress(
        testCase.streetType,
        testCase.streetName,
        testCase.streetNumber,
        testCase.postalCode,
        testCase.district
      );

      expect(result).toBeDefined();
      expect(result.overallStatus).toMatch(/valid|needs_review|invalid/);
      expect(result.searchResult).toBeDefined();
      expect(result.addressValidation).toBeDefined();
      expect(result.recommendedActions).toBeInstanceOf(Array);
      
      console.log(`    Status: ${result.overallStatus}, Confidence: ${result.searchResult.confidence}`);
    }
  });

});
