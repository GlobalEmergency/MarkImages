/**
 * S3 Data Cache Service
 *
 * Manages temporary storage of large JSON datasets in S3 for batch processing.
 * This allows serverless functions to process data in chunks without loading
 * entire datasets into memory on each invocation.
 *
 * Use Case:
 * - Chunk 1: Downloads complete JSON, uploads to S3, processes first chunk
 * - Chunk 2-N: Reads only needed chunk from S3, processes it
 * - Finalize: Cleans up S3 cache
 *
 * Auto-cleanup: Files older than 24 hours are automatically cleaned up
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

export interface CacheMetadata {
  jobId: string;
  totalRecords: number;
  uploadedAt: Date;
  dataSourceId: string;
  jsonPath?: string;
}

export class S3DataCacheService {
  private s3: S3Client;
  private bucket: string;
  private prefix = "sync-cache";

  constructor() {
    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;

    if (!region || !bucket) {
      throw new Error("AWS_REGION and AWS_S3_BUCKET_NAME must be configured");
    }

    this.s3 = new S3Client({ region });
    this.bucket = bucket;
  }

  /**
   * Upload complete JSON data to S3
   * @param jobId - Unique job identifier
   * @param data - Complete JSON data (will be stringified)
   * @param metadata - Additional metadata
   * @returns S3 key where data was stored
   */
  async uploadJsonData(
    jobId: string,
    data: unknown,
    metadata: Omit<CacheMetadata, "jobId" | "uploadedAt">
  ): Promise<string> {
    const key = this.getCacheKey(jobId);

    console.log(`📤 [S3Cache] Uploading data for job ${jobId} to S3...`);

    const body = JSON.stringify(data);
    const sizeInMB = (body.length / (1024 * 1024)).toFixed(2);

    console.log(`📦 [S3Cache] Data size: ${sizeInMB} MB`);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        Metadata: {
          jobId,
          totalRecords: metadata.totalRecords.toString(),
          dataSourceId: metadata.dataSourceId,
          jsonPath: metadata.jsonPath || "",
          uploadedAt: new Date().toISOString(),
          expiresIn: "86400", // 24 hours in seconds
        },
      })
    );

    console.log(`✅ [S3Cache] Upload complete: ${key}`);

    return key;
  }

  /**
   * Get a specific chunk of records from cached JSON
   * @param jobId - Job identifier
   * @param startIndex - Start index of chunk
   * @param chunkSize - Number of records to retrieve
   * @returns Array of records for the chunk
   */
  async getJsonChunk(
    jobId: string,
    startIndex: number,
    chunkSize: number
  ): Promise<Record<string, unknown>[]> {
    const key = this.getCacheKey(jobId);

    console.log(
      `📥 [S3Cache] Fetching chunk for job ${jobId} (${startIndex}-${startIndex + chunkSize - 1})`
    );

    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new Error("Empty response from S3");
      }

      const bodyString = await response.Body.transformToString();
      const data = JSON.parse(bodyString);

      // Handle different JSON structures
      let records: Record<string, unknown>[];

      if (Array.isArray(data)) {
        records = data;
      } else if (typeof data === "object" && data !== null) {
        // Try common paths
        const obj = data as Record<string, unknown>;
        records =
          (obj.records as Record<string, unknown>[]) ||
          (obj.data as Record<string, unknown>[]) ||
          (obj.items as Record<string, unknown>[]) ||
          (obj.results as Record<string, unknown>[]) ||
          [];
      } else {
        throw new Error("Invalid JSON structure in cache");
      }

      const chunk = records.slice(startIndex, startIndex + chunkSize);

      console.log(`✅ [S3Cache] Retrieved ${chunk.length} records from total ${records.length}`);

      return chunk;
    } catch (error) {
      console.error(`❌ [S3Cache] Error fetching chunk:`, error);
      throw new Error(
        `Failed to fetch chunk from S3: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get metadata about cached data
   * @param jobId - Job identifier
   * @returns Cache metadata or null if not found
   */
  async getCacheMetadata(jobId: string): Promise<CacheMetadata | null> {
    const key = this.getCacheKey(jobId);

    try {
      const response = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Metadata) {
        return null;
      }

      return {
        jobId: response.Metadata.jobid || jobId,
        totalRecords: parseInt(response.Metadata.totalrecords || "0", 10),
        dataSourceId: response.Metadata.datasourceid || "",
        jsonPath: response.Metadata.jsonpath || undefined,
        uploadedAt: new Date(response.Metadata.uploadedat || Date.now()),
      };
    } catch {
      console.warn(`⚠️ [S3Cache] Cache not found for job ${jobId}`);
      return null;
    }
  }

  /**
   * Check if cache exists for a job
   * @param jobId - Job identifier
   * @returns true if cache exists
   */
  async cacheExists(jobId: string): Promise<boolean> {
    const metadata = await this.getCacheMetadata(jobId);
    return metadata !== null;
  }

  /**
   * Delete cached data for a job
   * @param jobId - Job identifier
   */
  async deleteCache(jobId: string): Promise<void> {
    const key = this.getCacheKey(jobId);

    console.log(`🗑️ [S3Cache] Deleting cache for job ${jobId}`);

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      console.log(`✅ [S3Cache] Cache deleted: ${key}`);
    } catch (error) {
      console.error(`❌ [S3Cache] Error deleting cache:`, error);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Get the S3 key for a job's cache
   * @param jobId - Job identifier
   * @returns S3 key
   */
  private getCacheKey(jobId: string): string {
    return `${this.prefix}/${jobId}.json`;
  }
}
