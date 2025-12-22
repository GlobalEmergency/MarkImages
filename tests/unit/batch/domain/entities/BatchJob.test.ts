import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BatchJob, CreateBatchJobParams } from '@/batch/domain/entities/BatchJob'
import { JobStatus, JobType } from '@/batch/domain/value-objects'

describe('BatchJob Entity', () => {
  let baseParams: CreateBatchJobParams

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

    baseParams = {
      type: JobType.AED_CSV_EXPORT,
      name: 'Test Export Job',
      description: 'Test job description',
      config: {
        type: JobType.AED_CSV_EXPORT,
        chunkSize: 100,
        maxRetries: 3,
        retryDelayMs: 1000,
        timeoutMs: 300000,
        checkpointFrequency: 10,
        heartbeatIntervalMs: 30000,
        skipOnError: true,
        dryRun: false,
        validateOnly: false,
        notifyOnComplete: false,
        notifyOnError: false,
        fields: ['id', 'proposedName'],
        includeImages: false,
        format: 'csv' as const,
      },
      createdBy: 'user-123',
      organizationId: 'org-123',
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('create', () => {
    it('should create a new batch job with default status PENDING', () => {
      const job = BatchJob.create(baseParams)

      expect(job.status).toBe(JobStatus.PENDING)
      expect(job.type).toBe(JobType.AED_CSV_EXPORT)
      expect(job.name).toBe('Test Export Job')
      expect(job.createdBy).toBe('user-123')
    })

    it('should initialize progress and result as empty', () => {
      const job = BatchJob.create(baseParams)

      expect(job.progress.totalRecords).toBe(0)
      expect(job.progress.processedRecords).toBe(0)
      expect(job.result).toBeDefined()
    })

    it('should set timestamps correctly', () => {
      const job = BatchJob.create(baseParams)

      expect(job.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(job.updatedAt).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(job.startedAt).toBeNull()
      expect(job.completedAt).toBeNull()
    })

    it('should initialize recovery fields', () => {
      const job = BatchJob.create(baseParams)

      expect(job.lastHeartbeat).toBeNull()
      expect(job.lastCheckpointIndex).toBe(-1)
      expect(job.resumeCount).toBe(0)
    })

    it('should accept optional metadata and tags', () => {
      const params = {
        ...baseParams,
        metadata: { key: 'value' },
        tags: ['important', 'urgent'],
      }

      const job = BatchJob.create(params)

      expect(job.metadata).toEqual({ key: 'value' })
      expect(job.tags).toEqual(['important', 'urgent'])
    })
  })

  describe('start', () => {
    it('should transition from PENDING to IN_PROGRESS', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      expect(job.status).toBe(JobStatus.IN_PROGRESS)
    })

    it('should set startedAt and lastHeartbeat', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      expect(job.startedAt).toBeTruthy()
      expect(job.lastHeartbeat).toBeTruthy()
    })

    it('should start progress', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      expect(job.progress.startedAt).toBeTruthy()
    })

    it('should throw error if invalid transition', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      // Cannot start a job that's already in progress
      expect(() => job.start()).toThrow()
    })
  })

  describe('pause and resume', () => {
    it('should pause a running job', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.pause()

      expect(job.status).toBe(JobStatus.PAUSED)
    })

    it('should resume from paused state', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.pause()
      job.resume()

      expect(job.status).toBe(JobStatus.RESUMING)
      expect(job.resumeCount).toBe(1)
    })

    it('should increment resume count on each resume', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.pause()
      job.resume()
      job.continueProcessing()
      job.pause()
      job.resume()

      expect(job.resumeCount).toBe(2)
    })

    it('should update heartbeat on resume', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.pause()

      vi.advanceTimersByTime(60000) // Advance 1 minute
      job.resume()

      expect(job.lastHeartbeat).toEqual(new Date('2024-01-01T00:01:00.000Z'))
    })
  })

  describe('complete', () => {
    it('should complete successfully if no failures', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.complete()

      expect(job.status).toBe(JobStatus.COMPLETED)
      expect(job.completedAt).toBeTruthy()
    })

    it('should complete with warnings if there are failed records', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.updateProgress(job.progress.incrementFailed(5))
      job.complete()

      expect(job.status).toBe(JobStatus.COMPLETED_WITH_WARNINGS)
    })

    it('should set completedAt timestamp', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      vi.advanceTimersByTime(60000)
      job.complete()

      expect(job.completedAt).toEqual(new Date('2024-01-01T00:01:00.000Z'))
    })
  })

  describe('fail', () => {
    it('should mark job as failed', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.fail('Database connection lost')

      expect(job.status).toBe(JobStatus.FAILED)
      expect(job.completedAt).toBeTruthy()
    })

    it('should add error to result if error message provided', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.fail('Test error')

      const result = job.result
      expect(result).toBeDefined()
    })
  })

  describe('cancel', () => {
    it('should cancel a running job', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.cancel('User requested cancellation')

      expect(job.status).toBe(JobStatus.CANCELLED)
      expect(job.completedAt).toBeTruthy()
    })

    it('should store cancel reason in metadata', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.cancel('User requested')

      expect(job.metadata.cancelReason).toBe('User requested')
    })
  })

  describe('heartbeat', () => {
    it('should update heartbeat timestamp', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      vi.advanceTimersByTime(30000)
      job.heartbeat()

      expect(job.lastHeartbeat).toEqual(new Date('2024-01-01T00:00:30.000Z'))
    })

    it('should update updatedAt', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      vi.advanceTimersByTime(30000)
      const before = job.updatedAt
      job.heartbeat()

      expect(job.updatedAt.getTime()).toBeGreaterThan(before.getTime())
    })
  })

  describe('checkpoint', () => {
    it('should save checkpoint index', () => {
      const job = BatchJob.create(baseParams)
      job.checkpoint(99)

      expect(job.lastCheckpointIndex).toBe(99)
    })

    it('should allow multiple checkpoints', () => {
      const job = BatchJob.create(baseParams)
      job.checkpoint(50)
      job.checkpoint(100)
      job.checkpoint(150)

      expect(job.lastCheckpointIndex).toBe(150)
    })
  })

  describe('isStuck', () => {
    it('should not be stuck if not running', () => {
      const job = BatchJob.create(baseParams)

      expect(job.isStuck).toBe(false)
    })

    it('should not be stuck if heartbeat is recent', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.heartbeat()

      expect(job.isStuck).toBe(false)
    })

    it('should be stuck if no heartbeat for extended period', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      // Advance time beyond timeout threshold (heartbeatIntervalMs * 5)
      vi.advanceTimersByTime(200000) // More than 30s * 5 = 150s

      expect(job.isStuck).toBe(true)
    })

    it('should be stuck if running but no heartbeat and started long ago', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      // Clear the heartbeat that start() sets
      ;(job as any).data.lastHeartbeat = null

      vi.advanceTimersByTime(200000)

      expect(job.isStuck).toBe(true)
    })
  })

  describe('recoverFromStuck', () => {
    it('should recover stuck job to INTERRUPTED state', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      vi.advanceTimersByTime(200000) // Make it stuck

      job.recoverFromStuck()

      expect(job.status).toBe(JobStatus.INTERRUPTED)
      expect(job.metadata.recoveredFromStuck).toBe(true)
      expect(job.tags).toContain('auto-recovered')
    })

    it('should throw if job is not stuck or running', () => {
      const job = BatchJob.create(baseParams)

      expect(() => job.recoverFromStuck()).toThrow()
    })
  })

  describe('forceReset', () => {
    it('should force reset stuck job to INTERRUPTED', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      job.forceReset('Admin intervention')

      expect(job.status).toBe(JobStatus.INTERRUPTED)
      expect(job.metadata.forceResetReason).toBe('Admin intervention')
      expect(job.tags).toContain('force-reset')
    })

    it('should not allow reset of terminal jobs', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.complete()

      expect(() => job.forceReset('Test')).toThrow('Cannot reset terminal job')
    })
  })

  describe('setTotalRecords', () => {
    it('should set total records and calculate chunks', () => {
      const job = BatchJob.create(baseParams)
      job.setTotalRecords(250)

      expect(job.progress.totalRecords).toBe(250)
      expect(job.progress.totalChunks).toBe(3) // 250 / 100 chunk size = 2.5 -> 3
    })
  })

  describe('metadata and tags', () => {
    it('should allow setting metadata', () => {
      const job = BatchJob.create(baseParams)
      job.setMetadata('processingServer', 'server-1')

      expect(job.metadata.processingServer).toBe('server-1')
    })

    it('should allow adding tags', () => {
      const job = BatchJob.create(baseParams)
      job.addTag('high-priority')
      job.addTag('urgent')

      expect(job.tags).toContain('high-priority')
      expect(job.tags).toContain('urgent')
    })

    it('should not add duplicate tags', () => {
      const job = BatchJob.create(baseParams)
      job.addTag('test')
      job.addTag('test')

      expect(job.tags.filter((t) => t === 'test').length).toBe(1)
    })

    it('should allow removing tags', () => {
      const job = BatchJob.create(baseParams)
      job.addTag('temp')
      job.removeTag('temp')

      expect(job.tags).not.toContain('temp')
    })
  })

  describe('computed properties', () => {
    it('should correctly determine if terminal', () => {
      const job = BatchJob.create(baseParams)
      expect(job.isTerminal).toBe(false)

      job.start()
      expect(job.isTerminal).toBe(false)

      job.complete()
      expect(job.isTerminal).toBe(true)
    })

    it('should correctly determine if can resume', () => {
      const job = BatchJob.create(baseParams)
      job.start()
      job.pause()

      expect(job.canResume).toBe(true)
    })

    it('should correctly determine if can cancel', () => {
      const job = BatchJob.create(baseParams)
      expect(job.canCancel).toBe(true)

      job.start()
      expect(job.canCancel).toBe(true)

      job.complete()
      expect(job.canCancel).toBe(false)
    })

    it('should calculate duration correctly', () => {
      const job = BatchJob.create(baseParams)
      job.start()

      vi.advanceTimersByTime(60000) // 1 minute
      job.complete()

      expect(job.durationMs).toBe(60000)
    })
  })

  describe('serialization', () => {
    it('should serialize to JSON for API', () => {
      const job = BatchJob.create(baseParams)
      const json = job.toJSON()

      expect(json.id).toBeDefined()
      expect(json.type).toBe(JobType.AED_CSV_EXPORT)
      expect(json.name).toBe('Test Export Job')
      expect(json.status).toBe(JobStatus.PENDING)
      expect(typeof json.createdAt).toBe('string')
    })

    it('should serialize to detailed JSON', () => {
      const job = BatchJob.create(baseParams)
      const json = job.toDetailedJSON()

      expect(json.config).toBeDefined()
      expect(json.result).toBeDefined()
      expect(json.metadata).toBeDefined()
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute job from persistence data', () => {
      const original = BatchJob.create(baseParams)
      original.start()
      original.setTotalRecords(100)

      const data = original.toData()
      const reconstituted = BatchJob.reconstitute(data)

      expect(reconstituted.id).toBe(original.id)
      expect(reconstituted.status).toBe(JobStatus.IN_PROGRESS)
      expect(reconstituted.progress.totalRecords).toBe(100)
    })
  })

  describe('getResumeIndex', () => {
    it('should return next index after checkpoint', () => {
      const job = BatchJob.create(baseParams)
      job.checkpoint(99)

      expect(job.getResumeIndex()).toBe(100)
    })

    it('should return 0 if no checkpoint', () => {
      const job = BatchJob.create(baseParams)

      expect(job.getResumeIndex()).toBe(0) // -1 + 1
    })
  })
})
