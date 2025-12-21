/**
 * Test Factories and Builders
 * Provides convenient factory functions for creating test data
 */

import { faker } from '@faker-js/faker'
import { CsvPreview } from '@/import/domain/value-objects/CsvPreview'
import { ColumnMapping } from '@/import/domain/value-objects/ColumnMapping'
import { BatchJob, CreateBatchJobParams } from '@/batch/domain/entities/BatchJob'
import { JobType } from '@/batch/domain/value-objects'

/**
 * CSV Test Data Factory
 */
export const CsvFactory = {
  /**
   * Create a sample CSV preview with AED data
   */
  createAedCsvPreview(rowCount: number = 3): CsvPreview {
    const headers = [
      'Nombre del establecimiento',
      'Tipo de vía',
      'Nombre de la vía',
      'Número',
      'Código postal',
      'Distrito',
      'Latitud',
      'Longitud',
      'Email',
      'Teléfono',
    ]

    const rows: string[][] = []
    for (let i = 0; i < rowCount; i++) {
      rows.push([
        faker.company.name(),
        faker.helpers.arrayElement(['Calle', 'Avenida', 'Plaza', 'Paseo']),
        faker.location.street(),
        faker.location.buildingNumber(),
        '28' + faker.string.numeric(3),
        faker.helpers.arrayElement([
          'Centro',
          'Retiro',
          'Salamanca',
          'Chamartín',
          'Chamberí',
        ]),
        faker.location.latitude({ min: 40.3, max: 40.5 }).toString(),
        faker.location.longitude({ min: -3.8, max: -3.6 }).toString(),
        faker.internet.email(),
        faker.phone.number(),
      ])
    }

    return CsvPreview.fromRawData(headers, rows)
  },

  /**
   * Create minimal required CSV preview
   */
  createMinimalCsvPreview(): CsvPreview {
    return CsvPreview.fromRawData(
      ['Nombre', 'Calle', 'Número'],
      [
        ['Hospital Central', 'Gran Vía', '123'],
        ['Centro Comercial', 'Mayor', '45'],
      ]
    )
  },

  /**
   * Create CSV preview with custom headers and data
   */
  createCustomCsvPreview(headers: string[], rows: string[][]): CsvPreview {
    return CsvPreview.fromRawData(headers, rows)
  },
}

/**
 * Column Mapping Factory
 */
export const MappingFactory = {
  /**
   * Create required mappings for AED import
   */
  createRequiredMappings(): ColumnMapping[] {
    return [
      ColumnMapping.create('Nombre', 'proposedName', 1.0),
      ColumnMapping.create('Calle', 'streetName', 0.95),
      ColumnMapping.create('Número', 'streetNumber', 0.95),
    ]
  },

  /**
   * Create complete mappings including optional fields
   */
  createCompleteMappings(): ColumnMapping[] {
    return [
      ...MappingFactory.createRequiredMappings(),
      ColumnMapping.create('Email', 'submitterEmail', 0.9),
      ColumnMapping.create('Teléfono', 'submitterPhone', 0.85),
      ColumnMapping.create('Distrito', 'district', 0.8),
      ColumnMapping.create('Código postal', 'postalCode', 0.9),
    ]
  },

  /**
   * Create custom mapping
   */
  createMapping(
    csvColumn: string,
    systemField: string,
    confidence: number = 1.0
  ): ColumnMapping {
    return ColumnMapping.create(csvColumn, systemField, confidence)
  },
}

/**
 * Batch Job Factory
 */
export const BatchJobFactory = {
  /**
   * Create a basic batch job for testing
   */
  createJob(overrides: Partial<CreateBatchJobParams> = {}): BatchJob {
    const params: CreateBatchJobParams = {
      type: JobType.AED_EXPORT,
      name: 'Test Job ' + faker.string.uuid(),
      description: faker.lorem.sentence(),
      config: {
        chunkSize: 100,
        heartbeatIntervalMs: 30000,
        maxRetries: 3,
        timeoutMs: 300000,
      },
      createdBy: 'test-user-' + faker.string.uuid(),
      organizationId: 'test-org-' + faker.string.uuid(),
      ...overrides,
    }

    return BatchJob.create(params)
  },

  /**
   * Create a job in progress
   */
  createJobInProgress(processedRecords: number = 50, totalRecords: number = 100): BatchJob {
    const job = this.createJob()
    job.start()
    job.setTotalRecords(totalRecords)

    let currentProgress = job.progress
    for (let i = 0; i < processedRecords; i++) {
      currentProgress = currentProgress.incrementSuccess()
    }
    job.updateProgress(currentProgress)

    return job
  },

  /**
   * Create a completed job
   */
  createCompletedJob(successCount: number = 100, failedCount: number = 0): BatchJob {
    const job = this.createJob()
    job.start()
    job.setTotalRecords(successCount + failedCount)

    let currentProgress = job.progress
    for (let i = 0; i < successCount; i++) {
      currentProgress = currentProgress.incrementSuccess()
    }
    for (let i = 0; i < failedCount; i++) {
      currentProgress = currentProgress.incrementFailed()
    }
    job.updateProgress(currentProgress)
    job.complete()

    return job
  },

  /**
   * Create a failed job
   */
  createFailedJob(errorMessage: string = 'Test error'): BatchJob {
    const job = this.createJob()
    job.start()
    job.fail(errorMessage)

    return job
  },
}

/**
 * AED Test Data Factory
 */
export const AedFactory = {
  /**
   * Create test AED data
   */
  createAedData(overrides: Partial<any> = {}) {
    return {
      proposedName: faker.company.name(),
      streetType: faker.helpers.arrayElement(['Calle', 'Avenida', 'Plaza']),
      streetName: faker.location.street(),
      streetNumber: faker.location.buildingNumber(),
      postalCode: '28' + faker.string.numeric(3),
      district: faker.helpers.arrayElement(['Centro', 'Retiro', 'Salamanca']),
      latitude: faker.location.latitude({ min: 40.3, max: 40.5 }),
      longitude: faker.location.longitude({ min: -3.8, max: -3.6 }),
      submitterEmail: faker.internet.email(),
      submitterPhone: faker.phone.number(),
      ...overrides,
    }
  },

  /**
   * Create multiple AED records
   */
  createAedDataList(count: number): any[] {
    return Array.from({ length: count }, () => this.createAedData())
  },

  /**
   * Create minimal required AED data
   */
  createMinimalAedData() {
    return {
      proposedName: faker.company.name(),
      streetName: faker.location.street(),
      streetNumber: faker.location.buildingNumber(),
    }
  },
}

/**
 * User Test Data Factory
 */
export const UserFactory = {
  /**
   * Create test user
   */
  createUser(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: faker.helpers.arrayElement(['ADMIN', 'USER', 'VERIFIER']),
      organizationId: faker.string.uuid(),
      ...overrides,
    }
  },

  /**
   * Create admin user
   */
  createAdmin() {
    return this.createUser({ role: 'ADMIN' })
  },

  /**
   * Create regular user
   */
  createRegularUser() {
    return this.createUser({ role: 'USER' })
  },
}

/**
 * Wait helper for async operations in tests
 */
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wait for condition to be true (useful for testing async state updates)
 */
export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now()

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await waitFor(interval)
  }
}
