import { describe, it, expect, beforeEach } from 'vitest'
import { ImportSession } from '@/domain/import/entities/ImportSession'
import { ValidationResult } from '@/domain/import/value-objects/ValidationResult'
import { ColumnMapping } from '@/domain/import/value-objects/ColumnMapping'
import { CsvPreview } from '@/domain/import/value-objects/CsvPreview'

describe('ImportSession', () => {
  let session: ImportSession

  beforeEach(() => {
    session = ImportSession.create('user-123', 'test.csv', '/tmp/test.csv')
  })

  describe('Creación de sesión', () => {
    it('debe crear una sesión con estado inicial PREVIEW', () => {
      expect(session.currentStatus).toBe('PREVIEW')
      expect(session.uploadedFileName).toBe('test.csv')
      expect(session.uploadedBy).toBe('user-123')
      expect(session.csvPreview).toBeNull()
      expect(session.validation).toBeNull()
    })

    it('debe generar un ID único', () => {
      const session1 = ImportSession.create('user-1', 'file1.csv', '/tmp/1.csv')
      const session2 = ImportSession.create('user-1', 'file1.csv', '/tmp/1.csv')

      expect(session1.sessionId).not.toBe(session2.sessionId)
    })
  })

  describe('Flujo de estados: Preview -> Mapping', () => {
    it('debe permitir establecer preview desde estado PREVIEW', () => {
      const preview = CsvPreview.create(
        ['codigo', 'direccion'],
        [
          { codigo: 'DEA-001', direccion: 'Calle Test 1' },
          { codigo: 'DEA-002', direccion: 'Calle Test 2' },
        ],
        10
      )

      session.setPreview(preview)

      expect(session.currentStatus).toBe('MAPPING')
      expect(session.csvPreview).toBe(preview)
    })

    it('debe lanzar error al establecer preview en estado incorrecto', () => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      expect(() => session.setPreview(preview)).toThrow(
        'Can only set preview in PREVIEW status'
      )
    })
  })

  describe('Flujo de estados: Mapping -> Validating', () => {
    beforeEach(() => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)
    })

    it('debe permitir establecer mapeos desde estado MAPPING', () => {
      const mappings = [
        ColumnMapping.create('codigo', 'codigo_dea'),
        ColumnMapping.create('direccion', 'direccion'),
      ]

      session.setMappings(mappings)

      expect(session.currentStatus).toBe('VALIDATING')
      expect(session.columnMappings.size).toBe(2)
      expect(session.columnMappings.has('codigo_dea')).toBe(true)
      expect(session.columnMappings.has('direccion')).toBe(true)
    })

    it('debe permitir actualizar un mapeo individual', () => {
      const mapping = ColumnMapping.create('codigo', 'codigo_dea')

      session.updateMapping(mapping)

      expect(session.columnMappings.has('codigo_dea')).toBe(true)
    })

    it('debe permitir eliminar un mapeo', () => {
      const mapping = ColumnMapping.create('codigo', 'codigo_dea')
      session.updateMapping(mapping)

      session.removeMapping('codigo_dea')

      expect(session.columnMappings.has('codigo_dea')).toBe(false)
    })

    it('debe lanzar error al establecer mapeos en estado incorrecto', () => {
      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)

      expect(() => session.setMappings(mappings)).toThrow(
        'Can only set mappings in MAPPING status'
      )
    })
  })

  describe('Flujo de estados: Validating -> Ready', () => {
    beforeEach(() => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)
    })

    it('debe pasar a READY cuando la validación es exitosa', () => {
      const validation = ValidationResult.success()
      session.setValidation(validation)

      expect(session.currentStatus).toBe('READY')
      expect(session.validation).toBe(validation)
    })

    it('debe volver a MAPPING cuando hay errores críticos', () => {
      const validation = ValidationResult.withSingleIssue({
        row: 1,
        field: 'codigo',
        value: '',
        severity: 'CRITICAL',
        message: 'Código requerido',
      })

      session.setValidation(validation)

      expect(session.currentStatus).toBe('MAPPING')
    })

    it('debe pasar a READY cuando hay warnings pero no errores', () => {
      const validation = ValidationResult.withSingleIssue({
        row: 1,
        field: 'telefono',
        value: '123',
        severity: 'WARNING',
        message: 'Teléfono corto',
      })

      session.setValidation(validation)

      expect(session.currentStatus).toBe('READY')
    })

    it('debe lanzar error al establecer validación en estado incorrecto', () => {
      const validation = ValidationResult.success()
      session.setValidation(validation)

      expect(() => session.setValidation(validation)).toThrow(
        'Can only set validation in VALIDATING status'
      )
    })
  })

  describe('Flujo de estados: Ready -> Importing -> Completed', () => {
    beforeEach(() => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)

      const validation = ValidationResult.success()
      session.setValidation(validation)
    })

    it('debe iniciar importación desde estado READY', () => {
      session.startImport('batch-123')

      expect(session.currentStatus).toBe('IMPORTING')
      expect(session.importBatchId).toBe('batch-123')
    })

    it('debe completar importación desde estado IMPORTING', () => {
      session.startImport('batch-123')
      session.markAsCompleted()

      expect(session.currentStatus).toBe('COMPLETED')
    })

    it('debe lanzar error al iniciar importación en estado incorrecto', () => {
      expect(() => {
        const newSession = ImportSession.create('user', 'file.csv', '/tmp/file.csv')
        newSession.startImport('batch-123')
      }).toThrow('Can only start import when status is READY')
    })

    it('debe lanzar error al completar en estado incorrecto', () => {
      expect(() => session.markAsCompleted()).toThrow(
        'Can only complete when status is IMPORTING'
      )
    })
  })

  describe('Manejo de fallos', () => {
    it('debe poder marcar como fallido desde cualquier estado', () => {
      session.markAsFailed()
      expect(session.currentStatus).toBe('FAILED')
    })
  })

  describe('Navegación hacia atrás', () => {
    beforeEach(() => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)
    })

    it('debe permitir volver a MAPPING desde VALIDATING', () => {
      expect(session.currentStatus).toBe('VALIDATING')
      session.backToMapping()

      expect(session.currentStatus).toBe('MAPPING')
      expect(session.validation).toBeNull()
    })

    it('debe permitir volver a MAPPING desde READY', () => {
      const validation = ValidationResult.success()
      session.setValidation(validation)

      expect(session.currentStatus).toBe('READY')
      session.backToMapping()

      expect(session.currentStatus).toBe('MAPPING')
      expect(session.validation).toBeNull()
    })

    it('debe lanzar error al volver a MAPPING desde estado incorrecto', () => {
      expect(() => {
        const newSession = ImportSession.create('user', 'file.csv', '/tmp/file.csv')
        newSession.backToMapping()
      }).toThrow('Can only go back to mapping from VALIDATING or READY')
    })
  })

  describe('Validación de campos requeridos', () => {
    beforeEach(() => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)
    })

    it('debe detectar cuando faltan campos requeridos', () => {
      const requiredFields = ['codigo_dea', 'direccion', 'telefono']

      expect(session.hasAllRequiredMappings(requiredFields)).toBe(false)
    })

    it('debe detectar cuando todos los campos requeridos están presentes', () => {
      const mappings = [
        ColumnMapping.create('codigo', 'codigo_dea'),
        ColumnMapping.create('direccion', 'direccion'),
        ColumnMapping.create('telefono', 'telefono'),
      ]
      session.setMappings(mappings)
      session.backToMapping()

      const requiredFields = ['codigo_dea', 'direccion', 'telefono']

      expect(session.hasAllRequiredMappings(requiredFields)).toBe(true)
    })

    it('debe listar campos requeridos faltantes', () => {
      const mapping = ColumnMapping.create('codigo', 'codigo_dea')
      session.updateMapping(mapping)

      const requiredFields = ['codigo_dea', 'direccion', 'telefono']
      const missing = session.getMissingRequiredFields(requiredFields)

      expect(missing).toEqual(['direccion', 'telefono'])
    })
  })

  describe('Verificaciones de estado', () => {
    it('debe verificar si puede validar', () => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const requiredFields = ['codigo_dea']
      expect(session.canValidate(requiredFields)).toBe(false)

      const mapping = ColumnMapping.create('codigo', 'codigo_dea')
      session.updateMapping(mapping)

      expect(session.canValidate(requiredFields)).toBe(true)
    })

    it('debe verificar si puede importar', () => {
      expect(session.canImport()).toBe(false)

      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)

      const validation = ValidationResult.success()
      session.setValidation(validation)

      expect(session.canImport()).toBe(true)
    })

    it('no debe poder importar si hay errores críticos', () => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)

      const validation = ValidationResult.withSingleIssue({
        row: 1,
        field: 'codigo',
        value: '',
        severity: 'CRITICAL',
        message: 'Error',
      })
      session.setValidation(validation)

      expect(session.canImport()).toBe(false)
    })
  })

  describe('Serialización', () => {
    it('debe serializar y deserializar correctamente', () => {
      const preview = CsvPreview.create(['codigo'], [{ codigo: 'DEA-001' }], 1)
      session.setPreview(preview)

      const mappings = [ColumnMapping.create('codigo', 'codigo_dea')]
      session.setMappings(mappings)

      const json = session.toJSON()
      const restored = ImportSession.fromJSON(json)

      expect(restored.sessionId).toBe(session.sessionId)
      expect(restored.currentStatus).toBe(session.currentStatus)
      expect(restored.uploadedFileName).toBe(session.uploadedFileName)
      expect(restored.uploadedBy).toBe(session.uploadedBy)
      expect(restored.columnMappings.size).toBe(session.columnMappings.size)
    })
  })
})
