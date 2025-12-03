import { describe, it, expect } from 'vitest'
import { CsvPreview } from '@/domain/import/value-objects/CsvPreview'

describe('CsvPreview', () => {
  describe('Creación', () => {
    it('debe crear un preview con datos válidos', () => {
      const headers = ['codigo', 'nombre', 'direccion']
      const sampleRows = [
        ['DEA-001', 'DEA Test 1', 'Calle Test 1'],
        ['DEA-002', 'DEA Test 2', 'Calle Test 2'],
      ]
      const totalRows = 100

      const preview = CsvPreview.create(headers, sampleRows, totalRows)

      expect(preview.columnHeaders).toEqual(headers)
      expect(preview.sampleSize).toBe(2)
      expect(preview.totalRecords).toBe(100)
      expect(preview.columnCount).toBe(3)
    })

    it('debe usar punto y coma como delimitador por defecto', () => {
      const preview = CsvPreview.create(['col1'], [['val1']], 1)

      expect(preview.csvDelimiter).toBe(';')
    })

    it('debe permitir especificar un delimitador personalizado', () => {
      const preview = CsvPreview.create(['col1'], [['val1']], 1, ',')

      expect(preview.csvDelimiter).toBe(',')
    })

    it('debe lanzar error si no hay columnas', () => {
      expect(() => CsvPreview.create([], [], 0)).toThrow(
        'CSV must have at least one column'
      )
    })
  })

  describe('Acceso a datos', () => {
    const preview = CsvPreview.create(
      ['codigo', 'nombre', 'direccion'],
      [
        ['DEA-001', 'DEA Test 1', 'Calle Test 1'],
        ['DEA-002', 'DEA Test 2', 'Calle Test 2'],
        ['DEA-003', 'DEA Test 3', 'Calle Test 3'],
      ],
      100
    )

    it('debe retornar copias de headers para inmutabilidad', () => {
      const headers1 = preview.columnHeaders
      const headers2 = preview.columnHeaders

      expect(headers1).toEqual(headers2)
      expect(headers1).not.toBe(headers2) // Diferentes referencias
    })

    it('debe retornar copias de datos de muestra para inmutabilidad', () => {
      const data1 = preview.sampleData
      const data2 = preview.sampleData

      expect(data1).toEqual(data2)
      expect(data1).not.toBe(data2) // Diferentes referencias
    })

    it('debe obtener el índice de una columna por nombre', () => {
      expect(preview.getColumnIndex('codigo')).toBe(0)
      expect(preview.getColumnIndex('nombre')).toBe(1)
      expect(preview.getColumnIndex('direccion')).toBe(2)
    })

    it('debe retornar -1 para columnas que no existen', () => {
      expect(preview.getColumnIndex('inexistente')).toBe(-1)
    })

    it('debe verificar si una columna existe', () => {
      expect(preview.hasColumn('codigo')).toBe(true)
      expect(preview.hasColumn('nombre')).toBe(true)
      expect(preview.hasColumn('inexistente')).toBe(false)
    })

    it('debe obtener valores de muestra de una columna', () => {
      const values = preview.getColumnSampleValues('codigo')

      expect(values).toEqual(['DEA-001', 'DEA-002', 'DEA-003'])
    })

    it('debe retornar array vacío para columnas inexistentes', () => {
      const values = preview.getColumnSampleValues('inexistente')

      expect(values).toEqual([])
    })

    it('debe manejar valores vacíos en columnas', () => {
      const previewConVacios = CsvPreview.create(
        ['col1', 'col2'],
        [
          ['valor1', ''],
          ['', 'valor2'],
        ],
        2
      )

      const col1Values = previewConVacios.getColumnSampleValues('col1')
      const col2Values = previewConVacios.getColumnSampleValues('col2')

      expect(col1Values).toEqual(['valor1', ''])
      expect(col2Values).toEqual(['', 'valor2'])
    })
  })

  describe('Validación', () => {
    it('debe ser válido cuando todas las filas tienen el mismo número de columnas', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2', 'col3'],
        [
          ['a', 'b', 'c'],
          ['d', 'e', 'f'],
        ],
        2
      )

      expect(preview.isValid()).toBe(true)
    })

    it('debe ser inválido cuando las filas tienen diferente número de columnas', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2', 'col3'],
        [
          ['a', 'b', 'c'],
          ['d', 'e'], // Falta una columna
        ],
        2
      )

      expect(preview.isValid()).toBe(false)
    })

    it('debe ser inválido cuando las filas tienen más columnas que headers', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2'],
        [
          ['a', 'b'],
          ['c', 'd', 'e'], // Columna extra
        ],
        2
      )

      expect(preview.isValid()).toBe(false)
    })
  })

  describe('Estadísticas', () => {
    it('debe calcular estadísticas básicas correctamente', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2', 'col3'],
        [
          ['a', 'b', 'c'],
          ['d', 'e', 'f'],
        ],
        100
      )

      const stats = preview.getStats()

      expect(stats.totalRows).toBe(100)
      expect(stats.columnCount).toBe(3)
      expect(stats.sampleSize).toBe(2)
      expect(stats.hasEmptyColumns).toBe(false)
      expect(stats.emptyColumns).toEqual([])
    })

    it('debe detectar columnas completamente vacías', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2', 'col3'],
        [
          ['valor1', '', ''],
          ['valor2', '', ''],
        ],
        2
      )

      const stats = preview.getStats()

      expect(stats.hasEmptyColumns).toBe(true)
      expect(stats.emptyColumns).toEqual(['col2', 'col3'])
    })

    it('debe ignorar espacios en blanco al detectar columnas vacías', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2'],
        [
          ['valor', '  '],
          ['otro', '   '],
        ],
        2
      )

      const stats = preview.getStats()

      expect(stats.hasEmptyColumns).toBe(true)
      expect(stats.emptyColumns).toContain('col2')
    })

    it('no debe marcar como vacía una columna con al menos un valor', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2'],
        [
          ['', ''],
          ['valor', 'dato'],
        ],
        2
      )

      const stats = preview.getStats()

      expect(stats.hasEmptyColumns).toBe(false)
      expect(stats.emptyColumns).toEqual([])
    })
  })

  describe('Serialización', () => {
    it('debe serializar correctamente a JSON', () => {
      const headers = ['codigo', 'nombre']
      const sampleRows = [['DEA-001', 'Test']]
      const totalRows = 50
      const delimiter = ','

      const preview = CsvPreview.create(headers, sampleRows, totalRows, delimiter)
      const json = preview.toJSON()

      expect(json.headers).toEqual(headers)
      expect(json.sampleRows).toEqual(sampleRows)
      expect(json.totalRows).toBe(totalRows)
      expect(json.delimiter).toBe(delimiter)
    })

    it('debe deserializar correctamente desde JSON', () => {
      const data = {
        headers: ['col1', 'col2'],
        sampleRows: [['a', 'b']],
        totalRows: 100,
        delimiter: ';',
      }

      const preview = CsvPreview.fromJSON(data)

      expect(preview.columnHeaders).toEqual(data.headers)
      expect(preview.sampleData).toEqual(data.sampleRows)
      expect(preview.totalRecords).toBe(data.totalRows)
      expect(preview.csvDelimiter).toBe(data.delimiter)
    })

    it('debe mantener la integridad después de serializar y deserializar', () => {
      const original = CsvPreview.create(
        ['codigo', 'nombre', 'direccion'],
        [
          ['DEA-001', 'Test 1', 'Calle 1'],
          ['DEA-002', 'Test 2', 'Calle 2'],
        ],
        200,
        ','
      )

      const json = original.toJSON()
      const restored = CsvPreview.fromJSON(json)

      expect(restored.columnHeaders).toEqual(original.columnHeaders)
      expect(restored.sampleData).toEqual(original.sampleData)
      expect(restored.totalRecords).toBe(original.totalRecords)
      expect(restored.csvDelimiter).toBe(original.csvDelimiter)
      expect(restored.columnCount).toBe(original.columnCount)
      expect(restored.sampleSize).toBe(original.sampleSize)
    })
  })

  describe('Casos edge', () => {
    it('debe manejar una sola columna', () => {
      const preview = CsvPreview.create(['unica'], [['valor1'], ['valor2']], 2)

      expect(preview.columnCount).toBe(1)
      expect(preview.columnHeaders).toEqual(['unica'])
      expect(preview.sampleSize).toBe(2)
    })

    it('debe manejar una sola fila de muestra', () => {
      const preview = CsvPreview.create(['col1', 'col2'], [['a', 'b']], 1000)

      expect(preview.sampleSize).toBe(1)
      expect(preview.totalRecords).toBe(1000)
    })

    it('debe manejar preview sin filas de muestra', () => {
      const preview = CsvPreview.create(['col1', 'col2'], [], 1000)

      expect(preview.sampleSize).toBe(0)
      expect(preview.columnCount).toBe(2)
      expect(preview.isValid()).toBe(true)
    })

    it('debe manejar nombres de columnas con espacios', () => {
      const preview = CsvPreview.create(
        ['Código DEA', 'Nombre Completo', 'Dirección Principal'],
        [['001', 'Test', 'Calle Test']],
        1
      )

      expect(preview.hasColumn('Código DEA')).toBe(true)
      expect(preview.getColumnIndex('Nombre Completo')).toBe(1)
    })

    it('debe manejar nombres de columnas con caracteres especiales', () => {
      const preview = CsvPreview.create(
        ['código_dea', 'dirección (calle)', 'n°_portal'],
        [['001', 'Test', '10']],
        1
      )

      expect(preview.hasColumn('código_dea')).toBe(true)
      expect(preview.hasColumn('dirección (calle)')).toBe(true)
      expect(preview.hasColumn('n°_portal')).toBe(true)
    })

    it('debe manejar valores con delimitadores dentro de campos', () => {
      const preview = CsvPreview.create(
        ['col1', 'col2'],
        [
          ['valor;con;puntoycoma', 'normal'],
          ['otro', 'más;puntos;y;coma'],
        ],
        2,
        ';'
      )

      const col1Values = preview.getColumnSampleValues('col1')
      expect(col1Values[0]).toBe('valor;con;puntoycoma')
    })
  })

  describe('Casos de uso reales', () => {
    it('debe representar un CSV típico de importación de DEAs', () => {
      const preview = CsvPreview.create(
        [
          'Código',
          'Nombre',
          'Calle',
          'Número',
          'CP',
          'Distrito',
          'Latitud',
          'Longitud',
        ],
        [
          ['DEA-001', 'Centro Comercial', 'Gran Vía', '10', '28001', 'Centro', '40.4168', '-3.7038'],
          ['DEA-002', 'Hospital Norte', 'Paseo Castellana', '261', '28046', 'Fuencarral', '40.4634', '-3.6885'],
          ['DEA-003', 'Metro Sol', 'Puerta del Sol', 's/n', '28013', 'Centro', '40.4169', '-3.7035'],
        ],
        150,
        ';'
      )

      expect(preview.columnCount).toBe(8)
      expect(preview.sampleSize).toBe(3)
      expect(preview.totalRecords).toBe(150)
      expect(preview.isValid()).toBe(true)

      const stats = preview.getStats()
      expect(stats.hasEmptyColumns).toBe(false)

      expect(preview.hasColumn('Código')).toBe(true)
      expect(preview.hasColumn('Latitud')).toBe(true)
      expect(preview.hasColumn('Longitud')).toBe(true)
    })
  })
})
