-- CreateTable: sync_ndjson_cache
-- Caches compressed NDJSON data between sync chunks to avoid re-downloading
-- all records from external APIs on every resume iteration.
CREATE TABLE IF NOT EXISTS "sync_ndjson_cache" (
    "job_id" VARCHAR(36) NOT NULL,
    "compressed_data" BYTEA NOT NULL,
    "original_size" INTEGER NOT NULL DEFAULT 0,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_ndjson_cache_pkey" PRIMARY KEY ("job_id")
);
