-- @batchactions/state-prisma tables
-- These tables implement the StateStore + DistributedStateStore ports from @batchactions/core

-- CreateTable
CREATE TABLE IF NOT EXISTS "batchactions_jobs" (
    "id" VARCHAR(36) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "config" JSONB NOT NULL,
    "batches" JSONB NOT NULL DEFAULT '[]',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "startedAt" BIGINT,
    "completedAt" BIGINT,
    "distributed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "batchactions_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "batchactions_records" (
    "id" SERIAL NOT NULL,
    "jobId" VARCHAR(36) NOT NULL,
    "batchId" VARCHAR(36) NOT NULL,
    "recordIndex" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "raw" JSONB NOT NULL,
    "parsed" JSONB NOT NULL,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "processingError" TEXT,

    CONSTRAINT "batchactions_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "batchactions_batches" (
    "id" VARCHAR(36) NOT NULL,
    "jobId" VARCHAR(36) NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "workerId" VARCHAR(128),
    "claimedAt" BIGINT,
    "recordStartIndex" INTEGER NOT NULL DEFAULT 0,
    "recordEndIndex" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "batchactions_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "batchactions_records_jobId_recordIndex_key" ON "batchactions_records"("jobId", "recordIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "batchactions_records_jobId_status_idx" ON "batchactions_records"("jobId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "batchactions_records_jobId_batchId_idx" ON "batchactions_records"("jobId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "batchactions_batches_jobId_batchIndex_key" ON "batchactions_batches"("jobId", "batchIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "batchactions_batches_jobId_status_idx" ON "batchactions_batches"("jobId", "status");
