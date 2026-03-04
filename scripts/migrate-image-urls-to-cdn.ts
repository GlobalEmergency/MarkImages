#!/usr/bin/env tsx
/**
 * MIGRATION SCRIPT: Update Image URLs to use CDN
 *
 * This script migrates image URLs from S3 direct URLs to CDN URLs
 * (CloudFront or any other CDN configured in CDN_BASE_URL)
 *
 * Usage:
 *   npm run migrate-cdn               # Apply migration
 *   npm run migrate-cdn -- --dry-run  # Preview changes without applying
 *   npm run migrate-cdn -- --revert   # Revert to S3 direct URLs
 *
 * Requirements:
 *   - CDN_BASE_URL must be set in .env (e.g., https://d1l55ep6jkz7cn.cloudfront.net)
 *   - AWS_S3_BUCKET_NAME must be set in .env
 *   - AWS_REGION must be set in .env
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface MigrationStats {
  totalImages: number;
  originalUrlUpdated: number;
  processedUrlUpdated: number;
  thumbnailUrlUpdated: number;
  skipped: number;
  errors: number;
}

interface MigrationOptions {
  dryRun: boolean;
  revert: boolean;
}

/**
 * Extract the S3 key (path) from a full S3 URL
 */
function extractS3Key(url: string): string | null {
  // Match patterns:
  // https://bucket.s3.region.amazonaws.com/path/to/file.jpg
  // https://bucket.s3-region.amazonaws.com/path/to/file.jpg
  const match = url.match(/\.amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Build CDN URL from S3 key
 */
function buildCdnUrl(key: string, cdnBaseUrl: string): string {
  const baseUrl = cdnBaseUrl.endsWith("/") ? cdnBaseUrl.slice(0, -1) : cdnBaseUrl;
  return `${baseUrl}/${key}`;
}

/**
 * Build S3 direct URL from key
 */
function buildS3Url(key: string, bucketName: string, region: string): string {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Convert S3 URL to CDN URL
 */
function convertToCdnUrl(s3Url: string, cdnBaseUrl: string): string | null {
  const key = extractS3Key(s3Url);
  if (!key) return null;
  return buildCdnUrl(key, cdnBaseUrl);
}

/**
 * Convert CDN URL back to S3 URL
 */
function convertToS3Url(
  cdnUrl: string,
  cdnBaseUrl: string,
  bucketName: string,
  region: string
): string | null {
  const baseUrl = cdnBaseUrl.endsWith("/") ? cdnBaseUrl.slice(0, -1) : cdnBaseUrl;

  if (!cdnUrl.startsWith(baseUrl)) {
    return null; // Not a CDN URL
  }

  const key = cdnUrl.substring(baseUrl.length + 1); // +1 for the slash
  return buildS3Url(key, bucketName, region);
}

/**
 * Check if URL is an S3 URL
 */
function isS3Url(url: string): boolean {
  return url.includes(".s3.") || url.includes(".s3-");
}

/**
 * Check if URL is a CDN URL
 */
function isCdnUrl(url: string, cdnBaseUrl: string): boolean {
  const baseUrl = cdnBaseUrl.endsWith("/") ? cdnBaseUrl.slice(0, -1) : cdnBaseUrl;
  return url.startsWith(baseUrl);
}

/**
 * Migrate image URLs to CDN
 */
async function migrateImageUrlsToCdn(options: MigrationOptions): Promise<MigrationStats> {
  const { dryRun, revert } = options;

  const cdnBaseUrl = process.env.CDN_BASE_URL;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || "eu-west-1";

  if (!cdnBaseUrl && !revert) {
    throw new Error("CDN_BASE_URL is not configured in .env");
  }

  if (!bucketName) {
    throw new Error("AWS_S3_BUCKET_NAME is not configured in .env");
  }

  console.log("\n🚀 Image URL Migration Script");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`Mode: ${revert ? "🔄 REVERT to S3" : "⬆️  MIGRATE to CDN"}`);
  console.log(
    `Dry Run: ${dryRun ? "✅ YES (no changes will be applied)" : "❌ NO (changes will be applied)"}`
  );

  if (!revert && cdnBaseUrl) {
    console.log(`CDN URL: ${cdnBaseUrl}`);
  }
  console.log(`S3 Bucket: ${bucketName}`);
  console.log(`S3 Region: ${region}`);
  console.log("════════════════════════════════════════════════════════════\n");

  const stats: MigrationStats = {
    totalImages: 0,
    originalUrlUpdated: 0,
    processedUrlUpdated: 0,
    thumbnailUrlUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Fetch all images
    const images = await prisma.aedImage.findMany({
      select: {
        id: true,
        original_url: true,
        processed_url: true,
        thumbnail_url: true,
        aed_id: true,
        type: true,
      },
    });

    stats.totalImages = images.length;
    console.log(`📊 Found ${images.length} images in database\n`);

    let updatedCount = 0;

    for (const image of images) {
      try {
        const updates: any = {};
        let needsUpdate = false;

        // Process original_url
        if (image.original_url) {
          if (revert) {
            // Revert CDN URL to S3 URL
            if (cdnBaseUrl && isCdnUrl(image.original_url, cdnBaseUrl)) {
              const s3Url = convertToS3Url(image.original_url, cdnBaseUrl, bucketName, region);
              if (s3Url) {
                updates.original_url = s3Url;
                needsUpdate = true;
                stats.originalUrlUpdated++;
              }
            }
          } else {
            // Migrate S3 URL to CDN URL
            if (isS3Url(image.original_url)) {
              const cdnUrl = convertToCdnUrl(image.original_url, cdnBaseUrl!);
              if (cdnUrl) {
                updates.original_url = cdnUrl;
                needsUpdate = true;
                stats.originalUrlUpdated++;
              }
            }
          }
        }

        // Process processed_url
        if (image.processed_url) {
          if (revert) {
            if (cdnBaseUrl && isCdnUrl(image.processed_url, cdnBaseUrl)) {
              const s3Url = convertToS3Url(image.processed_url, cdnBaseUrl, bucketName, region);
              if (s3Url) {
                updates.processed_url = s3Url;
                needsUpdate = true;
                stats.processedUrlUpdated++;
              }
            }
          } else {
            if (isS3Url(image.processed_url)) {
              const cdnUrl = convertToCdnUrl(image.processed_url, cdnBaseUrl!);
              if (cdnUrl) {
                updates.processed_url = cdnUrl;
                needsUpdate = true;
                stats.processedUrlUpdated++;
              }
            }
          }
        }

        // Process thumbnail_url
        if (image.thumbnail_url) {
          if (revert) {
            if (cdnBaseUrl && isCdnUrl(image.thumbnail_url, cdnBaseUrl)) {
              const s3Url = convertToS3Url(image.thumbnail_url, cdnBaseUrl, bucketName, region);
              if (s3Url) {
                updates.thumbnail_url = s3Url;
                needsUpdate = true;
                stats.thumbnailUrlUpdated++;
              }
            }
          } else {
            if (isS3Url(image.thumbnail_url)) {
              const cdnUrl = convertToCdnUrl(image.thumbnail_url, cdnBaseUrl!);
              if (cdnUrl) {
                updates.thumbnail_url = cdnUrl;
                needsUpdate = true;
                stats.thumbnailUrlUpdated++;
              }
            }
          }
        }

        // Apply updates
        if (needsUpdate) {
          if (!dryRun) {
            await prisma.aedImage.update({
              where: { id: image.id },
              data: updates,
            });
          }

          updatedCount++;

          // Show progress every 100 images
          if (updatedCount % 100 === 0) {
            console.log(`   ⏳ Processed ${updatedCount} images...`);
          }
        } else {
          stats.skipped++;
        }
      } catch (error) {
        stats.errors++;
        console.error(`   ❌ Error processing image ${image.id}:`, error);
      }
    }

    // Print summary
    console.log("\n════════════════════════════════════════════════════════════");
    console.log("📊 MIGRATION SUMMARY");
    console.log("════════════════════════════════════════════════════════════");
    console.log(`Total images:        ${stats.totalImages}`);
    console.log(`Original URLs:       ${stats.originalUrlUpdated} updated`);
    console.log(`Processed URLs:      ${stats.processedUrlUpdated} updated`);
    console.log(`Thumbnail URLs:      ${stats.thumbnailUrlUpdated} updated`);
    console.log(`Skipped:             ${stats.skipped}`);
    console.log(`Errors:              ${stats.errors}`);
    console.log("════════════════════════════════════════════════════════════");

    if (dryRun) {
      console.log("\n⚠️  DRY RUN MODE: No changes were applied to the database");
      console.log("   Run without --dry-run to apply these changes\n");
    } else {
      console.log("\n✅ Migration completed successfully!\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }

  return stats;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const revert = args.includes("--revert");

  try {
    await migrateImageUrlsToCdn({ dryRun, revert });
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
