import { describe, it, expect } from 'vitest'
import { CsvRowMapper } from '@/import/domain/services/CsvRowMapper'
import { DynamicCsvRow } from '@/import/domain/value-objects/DynamicCsvRow'

describe('CsvRowMapper', () => {
  describe('buildDynamicRow', () => {
    it('should map raw data according to mappings', () => {
      const rawData = {
        NOMBRE: 'Hospital Central',
        CALLE: 'Gran Vía',
        NUMERO: '123',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'CALLE', systemField: 'streetName' },
        { csvColumn: 'NUMERO', systemField: 'streetNumber' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result).toBeInstanceOf(DynamicCsvRow)
      expect(result.get('proposedName')).toBe('Hospital Central')
      expect(result.get('streetName')).toBe('Gran Vía')
      expect(result.get('streetNumber')).toBe('123')
    })

    it('should trim whitespace from values', () => {
      const rawData = {
        NOMBRE: '  Hospital  ',
        CALLE: ' Gran Vía ',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'CALLE', systemField: 'streetName' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result.get('proposedName')).toBe('Hospital')
      expect(result.get('streetName')).toBe('Gran Vía')
    })

    it('should skip null values', () => {
      const rawData = {
        NOMBRE: 'Hospital',
        CALLE: null as unknown as string,
        NUMERO: '123',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'CALLE', systemField: 'streetName' },
        { csvColumn: 'NUMERO', systemField: 'streetNumber' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result.get('proposedName')).toBe('Hospital')
      expect(result.get('streetName')).toBeNull() // DynamicCsvRow.get() returns null for missing values
      expect(result.get('streetNumber')).toBe('123')
    })

    it('should skip undefined values', () => {
      const rawData = {
        NOMBRE: 'Hospital',
        NUMERO: '123',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'CALLE', systemField: 'streetName' },
        { csvColumn: 'NUMERO', systemField: 'streetNumber' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result.get('proposedName')).toBe('Hospital')
      expect(result.get('streetName')).toBeNull() // DynamicCsvRow.get() returns null for missing values
      expect(result.get('streetNumber')).toBe('123')
    })

    it('should skip empty strings', () => {
      const rawData = {
        NOMBRE: 'Hospital',
        CALLE: '',
        NUMERO: '   ',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'CALLE', systemField: 'streetName' },
        { csvColumn: 'NUMERO', systemField: 'streetNumber' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result.get('proposedName')).toBe('Hospital')
      expect(result.get('streetName')).toBeNull()
      expect(result.get('streetNumber')).toBeNull()
    })

    it('should handle empty mappings', () => {
      const rawData = {
        NOMBRE: 'Hospital',
        CALLE: 'Gran Vía',
      }

      const result = CsvRowMapper.buildDynamicRow(rawData, [])

      expect(result).toBeInstanceOf(DynamicCsvRow)
      expect(result.get('proposedName')).toBeNull()
    })

    it('should handle mappings for non-existent columns', () => {
      const rawData = {
        NOMBRE: 'Hospital',
      }

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'INEXISTENTE', systemField: 'someField' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(result.get('proposedName')).toBe('Hospital')
      expect(result.get('someField')).toBeNull()
    })

    it('should handle multiple mappings to same raw column', () => {
      const rawData = {
        COORDENADAS: '40.416775,-3.703790',
      }

      const mappings = [
        { csvColumn: 'COORDENADAS', systemField: 'latitude' },
        { csvColumn: 'COORDENADAS', systemField: 'longitude' },
      ]

      const result = CsvRowMapper.buildDynamicRow(rawData, mappings)

      // Both should get the same value (later processing would split it)
      expect(result.get('latitude')).toBe('40.416775,-3.703790')
      expect(result.get('longitude')).toBe('40.416775,-3.703790')
    })
  })

  describe('buildRawDataFromArray', () => {
    it('should build raw data from arrays', () => {
      const columnNames = ['NOMBRE', 'CALLE', 'NUMERO']
      const rowValues = ['Hospital Central', 'Gran Vía', '123']

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital Central',
        CALLE: 'Gran Vía',
        NUMERO: '123',
      })
    })

    it('should handle missing values with empty strings', () => {
      const columnNames = ['NOMBRE', 'CALLE', 'NUMERO']
      const rowValues = ['Hospital Central', 'Gran Vía'] // Missing last value

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital Central',
        CALLE: 'Gran Vía',
        NUMERO: '',
      })
    })

    it('should handle extra values (ignore them)', () => {
      const columnNames = ['NOMBRE', 'CALLE']
      const rowValues = ['Hospital Central', 'Gran Vía', 'Extra Value']

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital Central',
        CALLE: 'Gran Vía',
      })
    })

    it('should skip columns without names', () => {
      const columnNames = ['NOMBRE', '', 'NUMERO']
      const rowValues = ['Hospital', 'Ignored', '123']

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital',
        NUMERO: '123',
      })
    })

    it('should handle empty arrays', () => {
      const result = CsvRowMapper.buildRawDataFromArray([], [])
      expect(result).toEqual({})
    })

    it('should handle values array longer than column names', () => {
      const columnNames = ['NOMBRE']
      const rowValues = ['Hospital', 'Extra1', 'Extra2']

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital',
      })
    })

    it('should preserve empty string values in the array', () => {
      const columnNames = ['NOMBRE', 'CALLE', 'NUMERO']
      const rowValues = ['Hospital', '', '123']

      const result = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)

      expect(result).toEqual({
        NOMBRE: 'Hospital',
        CALLE: '',
        NUMERO: '123',
      })
    })
  })

  describe('integration: buildRawDataFromArray + buildDynamicRow', () => {
    it('should work together to process CSV rows', () => {
      const columnNames = ['NOMBRE', 'TIPO_VIA', 'NOMBRE_VIA', 'NUM']
      const rowValues = ['Hospital Central', 'Calle', 'Gran Vía', '123']

      const mappings = [
        { csvColumn: 'NOMBRE', systemField: 'proposedName' },
        { csvColumn: 'TIPO_VIA', systemField: 'streetType' },
        { csvColumn: 'NOMBRE_VIA', systemField: 'streetName' },
        { csvColumn: 'NUM', systemField: 'streetNumber' },
      ]

      const rawData = CsvRowMapper.buildRawDataFromArray(rowValues, columnNames)
      const dynamicRow = CsvRowMapper.buildDynamicRow(rawData, mappings)

      expect(dynamicRow.get('proposedName')).toBe('Hospital Central')
      expect(dynamicRow.get('streetType')).toBe('Calle')
      expect(dynamicRow.get('streetName')).toBe('Gran Vía')
      expect(dynamicRow.get('streetNumber')).toBe('123')
    })
  })
})
