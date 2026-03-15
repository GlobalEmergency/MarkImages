# Feature Request: Persist source data in StateStore for serverless chunk resume

## Problem

When using `BatchEngine.processChunk()` in serverless environments (Vercel, Lambda), each invocation requires calling `BatchEngine.restore()` + `engine.from(source, parser)` to resume processing. The engine correctly skips already-completed batches, but **the consumer must re-provide the full dataset on every resume**.

For API-backed sources, this means **re-downloading all records from the external API on every chunk iteration**. In a real-world case with 171k records (France AED dataset):

- Chunk size: 500 records / ~45s
- Total chunks needed: ~343 iterations
- **Each iteration re-downloads all 171,803 records** just to process the next 500
- Total API calls: ~343 × full dataset = ~58M redundant record fetches

## Current architecture

```
startSync:
  fetch ALL records → NDJSON → BufferSource → engine.from() → processChunk()

resumeSync:
  fetch ALL records AGAIN → NDJSON → BufferSource → engine.from() → processChunk()
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^
  Engine skips completed batches but still needs all records
  to rebuild batch-index-to-record mapping
```

### Why re-fetching happens

1. `StateStore.saveProcessedRecord()` only persists records **after** processing
2. Records in pending batches (not yet processed) are **never stored** in the StateStore
3. `BatchEngine.restore()` restores batch completion state but **NOT** the source data
4. The engine's `StartJob.processSequentially()` iterates ALL records from the source, using `completedBatchIndices` to skip already-done batches — but it still needs to **read through them** to maintain correct batch-index-to-record mapping

### Code evidence (`@batchactions/core` v0.0.6)

```typescript
// StartJob.processSequentially() — line 394 in dist/index.js
async processSequentially(records, processor) {
  const splitter = new BatchSplitter(this.ctx.batchSize);
  const iterator = splitter.split(records)[Symbol.asyncIterator]();
  for (;;) {
    const next = await iterator.next();
    if (next.done) { this.sourceFullyConsumed = true; break; }
    const { records: batchRecords, batchIndex } = next.value;
    // ↓ Skips completed batches, but still consumed all records up to here
    if (!this.ctx.completedBatchIndices.has(batchIndex)) {
      await this.processStreamBatch(batchRecords, batchIndex, processor);
    }
  }
}
```

## Proposed solution

Add an optional **source data persistence layer** to `StateStore` so the engine can cache the full dataset on first read and restore it on subsequent `processChunk()` calls without requiring `engine.from()` again.

### Option A: `StateStore` extension (minimal, recommended)

```typescript
interface StateStore {
  // ... existing methods ...

  /** Persist raw source data for a job (called once after first read). */
  saveSourceData?(jobId: string, data: string | Buffer): Promise<void>;

  /** Retrieve cached source data for resume. Returns null if not cached. */
  getSourceData?(jobId: string): Promise<string | Buffer | null>;

  /** Delete cached source data after job completes. */
  deleteSourceData?(jobId: string): Promise<void>;
}
```

- Optional methods → fully backward-compatible
- `BatchEngine.processChunk()` calls `saveSourceData()` after first source read (if method exists)
- `BatchEngine.restore()` tries `getSourceData()` before requiring `engine.from()`
- If `getSourceData()` returns data, `engine.from()` becomes optional on resume
- Compression (gzip) handled by each implementation, not by the engine

### Option B: `CachedSource` DataSource wrapper (no engine changes)

```typescript
import { gzipSync, gunzipSync } from "node:zlib";

class CachedSource implements DataSource {
  constructor(
    private readonly source: DataSource,
    private readonly stateStore: StateStore,
    private readonly jobId: string
  ) {}

  async *read(): AsyncIterable<string | Buffer> {
    // Try cache first
    const cached = await this.stateStore.getSourceData?.(this.jobId);
    if (cached) {
      yield cached;
      return;
    }

    // Read from source and cache for next resume
    const chunks: string[] = [];
    for await (const chunk of this.source.read()) {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      yield chunk;
    }

    const full = chunks.join("");
    await this.stateStore.saveSourceData?.(this.jobId, full);
  }

  sample(maxBytes?: number) {
    return this.source.sample(maxBytes);
  }
  metadata() {
    return this.source.metadata();
  }
}

// Usage:
engine.from(new CachedSource(bufferSource, stateStore, jobId), parser);
```

- No changes to `BatchEngine` internals
- Consumer wraps their source explicitly
- Could be shipped as part of `@batchactions/core` or as a separate util

### `PrismaStateStore` implementation

New table for `@batchactions/state-prisma`:

```prisma
model BatchactionsSourceCache {
  jobId          String   @id @db.VarChar(36)
  compressedData Bytes
  originalSize   Int      @default(0)
  createdAt      DateTime @default(now())

  @@map("batchactions_source_cache")
}
```

```sql
CREATE TABLE IF NOT EXISTS "batchactions_source_cache" (
    "job_id" VARCHAR(36) NOT NULL,
    "compressed_data" BYTEA NOT NULL,
    "original_size" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batchactions_source_cache_pkey" PRIMARY KEY ("job_id")
);
```

Implementation in `PrismaStateStore`:

```typescript
import { gzipSync, gunzipSync } from 'node:zlib';

// PrismaStateStore
async saveSourceData(jobId: string, data: string | Buffer): Promise<void> {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  const compressed = gzipSync(buf, { level: 6 });
  await this.prisma.batchactionsSourceCache.upsert({
    where: { jobId },
    create: {
      jobId,
      compressedData: compressed,
      originalSize: buf.length,
    },
    update: {
      compressedData: compressed,
      originalSize: buf.length,
    },
  });
}

async getSourceData(jobId: string): Promise<Buffer | null> {
  const cached = await this.prisma.batchactionsSourceCache.findUnique({
    where: { jobId },
  });
  if (!cached) return null;
  return gunzipSync(Buffer.from(cached.compressedData));
}

async deleteSourceData(jobId: string): Promise<void> {
  await this.prisma.batchactionsSourceCache
    .delete({ where: { jobId } })
    .catch(() => {});
}
```

The `batchactions-prisma init` CLI should include this table in the generated schema.

### `FileStateStore` implementation

```typescript
// FileStateStore
async saveSourceData(jobId: string, data: string | Buffer): Promise<void> {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  const compressed = gzipSync(buf, { level: 6 });
  await writeFile(this.sourceFilePath(jobId), compressed);
}

async getSourceData(jobId: string): Promise<Buffer | null> {
  try {
    const compressed = await readFile(this.sourceFilePath(jobId));
    return gunzipSync(compressed);
  } catch {
    return null;
  }
}

async deleteSourceData(jobId: string): Promise<void> {
  await unlink(this.sourceFilePath(jobId)).catch(() => {});
}

private sourceFilePath(jobId: string): string {
  return join(this.directory, `${jobId}.source.gz`);
}
```

### Cleanup integration

`BatchEngine` should call `deleteSourceData()` automatically when job reaches a terminal state (`COMPLETED`, `FAILED`, `ABORTED`):

```typescript
// In StartJob.execute(), after transitioning to COMPLETED:
if (this.ctx.stateStore.deleteSourceData) {
  await this.ctx.stateStore.deleteSourceData(this.ctx.jobId);
}
```

## Impact

| Metric                         | Before                              | After                                             |
| ------------------------------ | ----------------------------------- | ------------------------------------------------- |
| API downloads per sync         | ~343 (one per chunk)                | 1                                                 |
| Network I/O per sync           | ~343 × 85 MB = ~29 GB               | 85 MB (fetch) + 342 × 12 MB (cache reads) = ~4 GB |
| Time per resume                | ~2-3 min (download) + 45s (process) | ~2s (cache read) + 45s (process)                  |
| Total sync time (171k records) | ~17+ hours                          | ~4.5 hours                                        |

## Current workaround

We've implemented an application-level `sync_ndjson_cache` table with gzip compression in our `ExternalSyncService`. It works but belongs in `@batchactions` since **any `processChunk()` consumer with external data sources has this exact same problem**.

## Affected packages

- `@batchactions/core` — `StateStore` interface, `BatchEngine.restore()` / `processChunk()`
- `@batchactions/state-prisma` — `PrismaStateStore` implementation + new table
- `@batchactions/core` (FileStateStore) — file-based implementation

## Labels

`enhancement`, `serverless`, `state-store`, `performance`
