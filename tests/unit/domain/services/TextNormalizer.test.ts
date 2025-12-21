import { describe, it, expect } from 'vitest'
import { TextNormalizer } from '@/import/domain/services/TextNormalizer'

describe('TextNormalizer', () => {
  describe('normalize', () => {
    it('should convert text to lowercase', () => {
      const result = TextNormalizer.normalize('HELLO WORLD')
      expect(result).toBe('hello world')
    })

    it('should remove accents and diacritics', () => {
      const result = TextNormalizer.normalize('Café Español')
      expect(result).toBe('cafe espanol')
    })

    it('should remove punctuation', () => {
      const result = TextNormalizer.normalize('Hello, World! How are you?')
      expect(result).toBe('hello world how are you')
    })

    it('should normalize multiple spaces', () => {
      const result = TextNormalizer.normalize('Hello    World   Test')
      expect(result).toBe('hello world test')
    })

    it('should trim leading and trailing spaces', () => {
      const result = TextNormalizer.normalize('  Hello World  ')
      expect(result).toBe('hello world')
    })

    it('should handle null values', () => {
      const result = TextNormalizer.normalize(null)
      expect(result).toBe('')
    })

    it('should handle undefined values', () => {
      const result = TextNormalizer.normalize(undefined)
      expect(result).toBe('')
    })

    it('should handle empty strings', () => {
      const result = TextNormalizer.normalize('')
      expect(result).toBe('')
    })

    it('should handle complex Spanish text with multiple accents', () => {
      const result = TextNormalizer.normalize('Año Niño Señor')
      expect(result).toBe('ano nino senor')
    })
  })

  describe('normalizeAddress', () => {
    it('should combine street type, name and number', () => {
      const result = TextNormalizer.normalizeAddress('Calle', 'Gran Vía', '123')
      expect(result).toBe('c gran via 123')
    })

    it('should normalize various street types', () => {
      expect(TextNormalizer.normalizeAddress('Avenida', 'Principal', '1')).toBe('av principal 1')
      expect(TextNormalizer.normalizeAddress('Plaza', 'Mayor', '5')).toBe('pl mayor 5')
      expect(TextNormalizer.normalizeAddress('Paseo', 'Castellana', '10')).toBe('ps castellana 10')
    })

    it('should handle abbreviated street types', () => {
      expect(TextNormalizer.normalizeAddress('C/', 'Test', '1')).toBe('c test 1')
      expect(TextNormalizer.normalizeAddress('Av.', 'Test', '1')).toBe('av test 1')
    })

    it('should handle null values', () => {
      const result = TextNormalizer.normalizeAddress(null, null, null)
      expect(result).toBe('')
    })

    it('should handle partial address data', () => {
      expect(TextNormalizer.normalizeAddress('Calle', 'Test', null)).toBe('c test')
      expect(TextNormalizer.normalizeAddress(null, 'Test', '123')).toBe('test 123')
      expect(TextNormalizer.normalizeAddress('Calle', null, '123')).toBe('c 123')
    })

    it('should normalize complex addresses', () => {
      const result = TextNormalizer.normalizeAddress(
        'Avenida',
        'José María Pemán',
        '12-14'
      )
      expect(result).toBe('av jose maria peman 12-14')
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical texts', () => {
      const similarity = TextNormalizer.calculateSimilarity('hello', 'hello')
      expect(similarity).toBe(1.0)
    })

    it('should return 1.0 for texts that normalize to the same value', () => {
      const similarity = TextNormalizer.calculateSimilarity('Café', 'cafe')
      expect(similarity).toBe(1.0)
    })

    it('should return 0.0 for empty strings', () => {
      expect(TextNormalizer.calculateSimilarity('', '')).toBe(0.0)
      expect(TextNormalizer.calculateSimilarity('hello', '')).toBe(0.0)
      expect(TextNormalizer.calculateSimilarity('', 'world')).toBe(0.0)
    })

    it('should return high similarity for very similar texts', () => {
      const similarity = TextNormalizer.calculateSimilarity('hello', 'helo')
      expect(similarity).toBeGreaterThan(0.8)
    })

    it('should return low similarity for very different texts', () => {
      const similarity = TextNormalizer.calculateSimilarity('hello', 'world')
      expect(similarity).toBeLessThan(0.3)
    })

    it('should handle case insensitive comparison', () => {
      const similarity = TextNormalizer.calculateSimilarity('HELLO', 'hello')
      expect(similarity).toBe(1.0)
    })

    it('should calculate similarity for Spanish street names', () => {
      const similarity1 = TextNormalizer.calculateSimilarity(
        'Calle Mayor',
        'Calle Mayór'
      )
      expect(similarity1).toBe(1.0) // Same after normalization

      const similarity2 = TextNormalizer.calculateSimilarity(
        'Calle Mayor',
        'Calle Menor'
      )
      expect(similarity2).toBeGreaterThan(0.5) // Similar but different
    })
  })

  describe('areSimilar', () => {
    it('should return true for identical texts', () => {
      expect(TextNormalizer.areSimilar('hello', 'hello')).toBe(true)
    })

    it('should return true for very similar texts with default threshold', () => {
      expect(TextNormalizer.areSimilar('hello', 'helo')).toBe(false) // Not similar enough
      expect(TextNormalizer.areSimilar('hello world', 'hello world!')).toBe(true)
    })

    it('should respect custom threshold', () => {
      expect(TextNormalizer.areSimilar('hello', 'helo', 0.8)).toBe(true)
      expect(TextNormalizer.areSimilar('hello', 'helo', 0.95)).toBe(false)
    })

    it('should handle accents properly', () => {
      expect(TextNormalizer.areSimilar('Café', 'Cafe')).toBe(true)
    })
  })

  describe('areExactMatch', () => {
    it('should return true for exact matches after normalization', () => {
      expect(TextNormalizer.areExactMatch('Hello', 'hello')).toBe(true)
      expect(TextNormalizer.areExactMatch('Café', 'cafe')).toBe(true)
      expect(TextNormalizer.areExactMatch('Hello!!!', 'Hello')).toBe(true)
    })

    it('should return false for different texts', () => {
      expect(TextNormalizer.areExactMatch('hello', 'world')).toBe(false)
      expect(TextNormalizer.areExactMatch('café', 'coffee')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(TextNormalizer.areExactMatch('', '')).toBe(true)
      expect(TextNormalizer.areExactMatch('hello', '')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle strings with only punctuation', () => {
      const result = TextNormalizer.normalize('!!!@#$%')
      expect(result).toBe('')
    })

    it('should handle strings with only spaces', () => {
      const result = TextNormalizer.normalize('     ')
      expect(result).toBe('')
    })

    it('should handle special characters', () => {
      const result = TextNormalizer.normalize('Test & Co., Inc.')
      expect(result).toBe('test co inc')
    })

    it('should handle numbers mixed with text', () => {
      const result = TextNormalizer.normalize('Calle 123')
      expect(result).toBe('calle 123')
    })

    it('should handle Unicode characters beyond basic accents', () => {
      const result = TextNormalizer.normalize('Ñandú')
      expect(result).toBe('nandu')
    })
  })
})
