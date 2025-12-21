import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JobProgress } from '@/batch/domain/value-objects/JobProgress'

describe('JobProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('create', () => {
    it('should create empty progress with default values', () => {
      const progress = JobProgress.empty()

      expect(progress.totalRecords).toBe(0)
      expect(progress.processedRecords).toBe(0)
      expect(progress.successfulRecords).toBe(0)
      expect(progress.failedRecords).toBe(0)
      expect(progress.skippedRecords).toBe(0)
      expect(progress.warningRecords).toBe(0)
      expect(progress.currentChunk).toBe(0)
      expect(progress.totalChunks).toBe(0)
      expect(progress.lastProcessedIndex).toBe(-1)
      expect(progress.estimatedRemainingMs).toBeNull()
      expect(progress.startedAt).toBeNull()
      expect(progress.lastActivityAt).toBeNull()
    })

    it('should create progress with custom values', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 50,
        successfulRecords: 45,
        failedRecords: 5,
      })

      expect(progress.totalRecords).toBe(100)
      expect(progress.processedRecords).toBe(50)
      expect(progress.successfulRecords).toBe(45)
      expect(progress.failedRecords).toBe(5)
    })
  })

  describe('computed properties', () => {
    it('should calculate percentage correctly', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 50,
      })

      expect(progress.percentage).toBe(50)
    })

    it('should return 0 percentage when total is 0', () => {
      const progress = JobProgress.create({
        totalRecords: 0,
        processedRecords: 0,
      })

      expect(progress.percentage).toBe(0)
    })

    it('should calculate remaining records', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 30,
      })

      expect(progress.remainingRecords).toBe(70)
    })

    it('should not return negative remaining records', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 120,
      })

      expect(progress.remainingRecords).toBe(0)
    })

    it('should determine if complete', () => {
      const completeProgress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 100,
      })

      const incompleteProgress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 50,
      })

      expect(completeProgress.isComplete).toBe(true)
      expect(incompleteProgress.isComplete).toBe(false)
    })

    it('should calculate error rate', () => {
      const progress = JobProgress.create({
        processedRecords: 100,
        failedRecords: 10,
      })

      expect(progress.errorRate).toBe(10)
    })

    it('should return 0 error rate when no records processed', () => {
      const progress = JobProgress.create({
        processedRecords: 0,
        failedRecords: 0,
      })

      expect(progress.errorRate).toBe(0)
    })

    it('should calculate success rate', () => {
      const progress = JobProgress.create({
        processedRecords: 100,
        successfulRecords: 90,
      })

      expect(progress.successRate).toBe(90)
    })

    it('should calculate elapsed time', () => {
      const startTime = new Date('2024-01-01T00:00:00.000Z')
      const endTime = new Date('2024-01-01T00:05:00.000Z') // 5 minutes later

      const progress = JobProgress.create({
        startedAt: startTime,
        lastActivityAt: endTime,
      })

      expect(progress.elapsedMs).toBe(5 * 60 * 1000) // 5 minutes in ms
    })

    it('should use current time if lastActivityAt is null', () => {
      const startTime = new Date('2024-01-01T00:00:00.000Z')
      vi.setSystemTime(new Date('2024-01-01T00:03:00.000Z'))

      const progress = JobProgress.create({
        startedAt: startTime,
        lastActivityAt: null,
      })

      expect(progress.elapsedMs).toBe(3 * 60 * 1000) // 3 minutes in ms
    })

    it('should calculate average time per record', () => {
      const startTime = new Date('2024-01-01T00:00:00.000Z')
      const endTime = new Date('2024-01-01T00:10:00.000Z')

      const progress = JobProgress.create({
        startedAt: startTime,
        lastActivityAt: endTime,
        processedRecords: 100,
      })

      expect(progress.averageTimePerRecordMs).toBe(6000) // 10 min / 100 records = 6s per record
    })
  })

  describe('immutable updates', () => {
    it('should return new instance with withTotal', () => {
      const original = JobProgress.empty()
      const updated = original.withTotal(100, 10)

      expect(updated).not.toBe(original)
      expect(updated.totalRecords).toBe(100)
      expect(updated.totalChunks).toBe(10)
      expect(original.totalRecords).toBe(0) // Original unchanged
    })

    it('should calculate totalChunks automatically if not provided', () => {
      const progress = JobProgress.empty().withTotal(250)

      expect(progress.totalChunks).toBe(3) // Math.ceil(250 / 100)
    })

    it('should increment success and update lastActivityAt', () => {
      const progress = JobProgress.empty()
      const updated = progress.incrementSuccess()

      expect(updated.successfulRecords).toBe(1)
      expect(updated.processedRecords).toBe(1)
      expect(updated.lastActivityAt).toBeTruthy()
    })

    it('should increment success by count', () => {
      const progress = JobProgress.empty()
      const updated = progress.incrementSuccess(5)

      expect(updated.successfulRecords).toBe(5)
      expect(updated.processedRecords).toBe(5)
    })

    it('should increment failed records', () => {
      const progress = JobProgress.empty()
      const updated = progress.incrementFailed(3)

      expect(updated.failedRecords).toBe(3)
      expect(updated.processedRecords).toBe(3)
    })

    it('should increment skipped records', () => {
      const progress = JobProgress.empty()
      const updated = progress.incrementSkipped(2)

      expect(updated.skippedRecords).toBe(2)
      expect(updated.processedRecords).toBe(2)
    })

    it('should increment warning records without affecting processed count', () => {
      const progress = JobProgress.create({ processedRecords: 10 })
      const updated = progress.incrementWarning(1)

      expect(updated.warningRecords).toBe(1)
      expect(updated.processedRecords).toBe(10) // Unchanged
    })

    it('should advance chunk', () => {
      const progress = JobProgress.create({ currentChunk: 0 })
      const updated = progress.advanceChunk()

      expect(updated.currentChunk).toBe(1)
    })

    it('should update last processed index', () => {
      const progress = JobProgress.empty()
      const updated = progress.withLastProcessedIndex(99)

      expect(updated.lastProcessedIndex).toBe(99)
    })

    it('should start progress with timestamps', () => {
      const progress = JobProgress.empty()
      const updated = progress.start()

      expect(updated.startedAt).toBeTruthy()
      expect(updated.lastActivityAt).toBeTruthy()
    })
  })

  describe('calculateEstimatedRemaining', () => {
    it('should calculate estimated remaining time', () => {
      const startTime = new Date('2024-01-01T00:00:00.000Z')
      const currentTime = new Date('2024-01-01T00:10:00.000Z')

      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 50,
        startedAt: startTime,
        lastActivityAt: currentTime,
      })

      const updated = progress.calculateEstimatedRemaining()

      // Processed 50 in 10 minutes = 12s per record
      // Remaining 50 records * 12s = 600s = 10 minutes
      expect(updated.estimatedRemainingMs).toBe(10 * 60 * 1000)
    })

    it('should return 0 when no records processed', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 0,
      })

      const updated = progress.calculateEstimatedRemaining()

      expect(updated.estimatedRemainingMs).toBe(0)
    })

    it('should return 0 when no records remaining', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 100,
      })

      const updated = progress.calculateEstimatedRemaining()

      expect(updated.estimatedRemainingMs).toBe(0)
    })
  })

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
        processedRecords: 50,
        successfulRecords: 45,
        failedRecords: 5,
      })

      const json = progress.toJSON()

      expect(json.totalRecords).toBe(100)
      expect(json.processedRecords).toBe(50)
      expect(json.percentage).toBe(50)
      expect(json.hasMore).toBe(true)
    })

    it('should deserialize from JSON', () => {
      const json = {
        totalRecords: 100,
        processedRecords: 50,
        successfulRecords: 45,
        failedRecords: 5,
        skippedRecords: 0,
        warningRecords: 0,
        currentChunk: 1,
        totalChunks: 10,
        lastProcessedIndex: 49,
        estimatedRemainingMs: 60000,
        startedAt: new Date('2024-01-01T00:00:00.000Z'),
        lastActivityAt: new Date('2024-01-01T00:05:00.000Z'),
      }

      const progress = JobProgress.fromJSON(json)

      expect(progress.totalRecords).toBe(100)
      expect(progress.processedRecords).toBe(50)
      expect(progress.startedAt).toBeInstanceOf(Date)
      expect(progress.lastActivityAt).toBeInstanceOf(Date)
    })

    it('should handle null dates in deserialization', () => {
      const json = {
        totalRecords: 100,
        processedRecords: 50,
        successfulRecords: 50,
        failedRecords: 0,
        skippedRecords: 0,
        warningRecords: 0,
        currentChunk: 0,
        totalChunks: 1,
        lastProcessedIndex: -1,
        estimatedRemainingMs: null,
        startedAt: null,
        lastActivityAt: null,
      }

      const progress = JobProgress.fromJSON(json)

      expect(progress.startedAt).toBeNull()
      expect(progress.lastActivityAt).toBeNull()
    })
  })

  describe('immutability', () => {
    it('should not allow direct modification of internal data', () => {
      const progress = JobProgress.create({
        totalRecords: 100,
      })

      // TypeScript should prevent this, but test runtime immutability
      expect(() => {
        ;(progress as any).data.totalRecords = 200
      }).toThrow()
    })

    it('should create new instances for all updates', () => {
      const original = JobProgress.empty()
      const updated1 = original.withTotal(100)
      const updated2 = updated1.incrementSuccess()
      const updated3 = updated2.incrementFailed()

      expect(updated1).not.toBe(original)
      expect(updated2).not.toBe(updated1)
      expect(updated3).not.toBe(updated2)
    })
  })
})
