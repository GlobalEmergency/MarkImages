import { describe, it, expect } from 'vitest'
import {
  ValidationResult,
  type ValidationIssue,
} from '@/domain/import/value-objects/ValidationResult'

describe('ValidationResult', () => {
  describe('Creación de resultados', () => {
    it('debe crear un resultado exitoso sin issues', () => {
      const result = ValidationResult.success()

      expect(result.totalIssues).toBe(0)
      expect(result.isValid()).toBe(true)
      expect(result.hasCriticalErrors()).toBe(false)
    })

    it('debe crear un resultado con issues', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'codigo',
          value: 'ABC',
          severity: 'ERROR',
          message: 'Código inválido',
        },
      ]

      const result = ValidationResult.withIssues(issues)

      expect(result.totalIssues).toBe(1)
      expect(result.allIssues).toEqual(issues)
    })

    it('debe crear un resultado con un solo issue', () => {
      const issue: ValidationIssue = {
        row: 1,
        field: 'direccion',
        value: '',
        severity: 'CRITICAL',
        message: 'Dirección requerida',
      }

      const result = ValidationResult.withSingleIssue(issue)

      expect(result.totalIssues).toBe(1)
      expect(result.allIssues[0]).toEqual(issue)
    })
  })

  describe('Filtrado de issues por severidad', () => {
    const mixedIssues: ValidationIssue[] = [
      {
        row: 1,
        field: 'codigo',
        value: 'ABC',
        severity: 'CRITICAL',
        message: 'Error crítico',
      },
      {
        row: 2,
        field: 'direccion',
        value: '',
        severity: 'ERROR',
        message: 'Error normal',
      },
      {
        row: 3,
        field: 'telefono',
        value: '123',
        severity: 'WARNING',
        message: 'Advertencia',
      },
      {
        row: 4,
        field: 'email',
        value: 'test@test.com',
        severity: 'INFO',
        message: 'Información',
      },
    ]

    it('debe filtrar errores críticos correctamente', () => {
      const result = ValidationResult.withIssues(mixedIssues)

      expect(result.criticalErrors).toHaveLength(1)
      expect(result.criticalErrors[0].severity).toBe('CRITICAL')
    })

    it('debe filtrar errores correctamente', () => {
      const result = ValidationResult.withIssues(mixedIssues)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].severity).toBe('ERROR')
    })

    it('debe filtrar warnings correctamente', () => {
      const result = ValidationResult.withIssues(mixedIssues)

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].severity).toBe('WARNING')
    })

    it('debe filtrar infos correctamente', () => {
      const result = ValidationResult.withIssues(mixedIssues)

      expect(result.infos).toHaveLength(1)
      expect(result.infos[0].severity).toBe('INFO')
    })
  })

  describe('Validación de estado', () => {
    it('debe ser válido cuando no hay errores ni errores críticos', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'telefono',
          value: '123',
          severity: 'WARNING',
          message: 'Advertencia',
        },
      ]

      const result = ValidationResult.withIssues(issues)

      expect(result.isValid()).toBe(true)
      expect(result.hasWarnings()).toBe(true)
    })

    it('debe ser inválido cuando hay errores', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'codigo',
          value: 'ABC',
          severity: 'ERROR',
          message: 'Error',
        },
      ]

      const result = ValidationResult.withIssues(issues)

      expect(result.isValid()).toBe(false)
    })

    it('debe ser inválido cuando hay errores críticos', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'codigo',
          value: 'ABC',
          severity: 'CRITICAL',
          message: 'Error crítico',
        },
      ]

      const result = ValidationResult.withIssues(issues)

      expect(result.isValid()).toBe(false)
      expect(result.hasCriticalErrors()).toBe(true)
    })
  })

  describe('Agrupación de issues', () => {
    const issues: ValidationIssue[] = [
      {
        row: 1,
        field: 'codigo',
        value: 'ABC',
        severity: 'ERROR',
        message: 'Error 1',
      },
      {
        row: 1,
        field: 'direccion',
        value: '',
        severity: 'ERROR',
        message: 'Error 2',
      },
      {
        row: 2,
        field: 'codigo',
        value: 'XYZ',
        severity: 'WARNING',
        message: 'Advertencia',
      },
    ]

    it('debe agrupar issues por fila', () => {
      const result = ValidationResult.withIssues(issues)
      const grouped = result.groupByRow()

      expect(grouped.size).toBe(2)
      expect(grouped.get(1)).toHaveLength(2)
      expect(grouped.get(2)).toHaveLength(1)
    })

    it('debe agrupar issues por campo', () => {
      const result = ValidationResult.withIssues(issues)
      const grouped = result.groupByField()

      expect(grouped.size).toBe(2)
      expect(grouped.get('codigo')).toHaveLength(2)
      expect(grouped.get('direccion')).toHaveLength(1)
    })
  })

  describe('Resumen de validación', () => {
    it('debe generar un resumen correcto', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'codigo',
          value: 'ABC',
          severity: 'CRITICAL',
          message: 'Crítico',
        },
        {
          row: 2,
          field: 'direccion',
          value: '',
          severity: 'ERROR',
          message: 'Error',
        },
        {
          row: 3,
          field: 'telefono',
          value: '123',
          severity: 'WARNING',
          message: 'Advertencia',
        },
        {
          row: 4,
          field: 'email',
          value: 'test',
          severity: 'INFO',
          message: 'Info',
        },
      ]

      const result = ValidationResult.withIssues(issues)
      const summary = result.getSummary()

      expect(summary.totalIssues).toBe(4)
      expect(summary.criticalCount).toBe(1)
      expect(summary.errorCount).toBe(1)
      expect(summary.warningCount).toBe(1)
      expect(summary.infoCount).toBe(1)
      expect(summary.isValid).toBe(false)
      expect(summary.canProceed).toBe(false)
    })

    it('debe permitir proceder si no hay errores críticos', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'telefono',
          value: '123',
          severity: 'WARNING',
          message: 'Advertencia',
        },
      ]

      const result = ValidationResult.withIssues(issues)
      const summary = result.getSummary()

      expect(summary.canProceed).toBe(true)
    })
  })

  describe('Combinación de resultados', () => {
    it('debe combinar múltiples resultados', () => {
      const result1 = ValidationResult.withSingleIssue({
        row: 1,
        field: 'codigo',
        value: 'ABC',
        severity: 'ERROR',
        message: 'Error 1',
      })

      const result2 = ValidationResult.withSingleIssue({
        row: 2,
        field: 'direccion',
        value: '',
        severity: 'WARNING',
        message: 'Advertencia',
      })

      const combined = ValidationResult.combine([result1, result2])

      expect(combined.totalIssues).toBe(2)
      expect(combined.errors).toHaveLength(1)
      expect(combined.warnings).toHaveLength(1)
    })
  })

  describe('Serialización', () => {
    it('debe serializar y deserializar correctamente', () => {
      const issues: ValidationIssue[] = [
        {
          row: 1,
          field: 'codigo',
          value: 'ABC',
          severity: 'ERROR',
          message: 'Error',
        },
      ]

      const original = ValidationResult.withIssues(issues)
      const json = original.toJSON()
      const restored = ValidationResult.fromJSON(json)

      expect(restored.totalIssues).toBe(original.totalIssues)
      expect(restored.allIssues).toEqual(original.allIssues)
      expect(restored.getSummary()).toEqual(original.getSummary())
    })
  })
})
