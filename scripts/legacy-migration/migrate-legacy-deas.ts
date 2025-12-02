#!/usr/bin/env tsx
/**
 * Legacy DEA Migration Script
 * Migrates data from legacy dea_records and verification_sessions tables
 * to the current architecture
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/client";
import { loadConfig, parseCommandLineArgs } from "./config";
import { LegacyDataExtractor } from "./services/LegacyDataExtractor";
import { DataTransformer } from "./services/DataTransformer";
import { ImageMigrator } from "./services/ImageMigrator";
import { BatchCreator } from "./services/BatchCreator";
import type { TransformedAed, MigrationError } from "./types";

async function main() {
  console.log("🚀 Starting Legacy DEA Migration\n");
  console.log("━".repeat(60));

  // Load configuration
  const cmdArgs = parseCommandLineArgs();
  const config = { ...loadConfig(), ...cmdArgs };

  if (config.dryRun) {
    console.log("⚠️  DRY RUN MODE - No data will be written\n");
  }

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  const errors: MigrationError[] = [];

  // Initialize services with Prisma v7 adapters
  const currentAdapter = new PrismaPg({
    connectionString: config.currentDatabaseUrl,
  });
  const currentDb = new PrismaClient({ adapter: currentAdapter });

  // Legacy DB with separate adapter
  const legacyAdapter = new PrismaPg({
    connectionString: config.legacyDatabaseUrl,
  });
  const legacyDb = new PrismaClient({ adapter: legacyAdapter });

  const legacyExtractor = new LegacyDataExtractor(legacyDb);
  const transformer = new DataTransformer();
  const batchCreator = new BatchCreator(currentDb);

  let imageMigrator: ImageMigrator | null = null;
  if (!config.skipImages) {
    imageMigrator = new ImageMigrator(
      config.s3Bucket,
      config.s3Region,
      config.awsAccessKeyId,
      config.awsSecretAccessKey
    );
  }

  let batchId: string | null = null;

  try {
    // 1. Get already migrated IDs (idempotency)
    console.log("📊 Checking for already migrated records...");
    const migratedRecords = await currentDb.aed.findMany({
      where: { source_origin: "LEGACY_MIGRATION" },
      select: { external_reference: true },
    });
    const alreadyMigratedIds = migratedRecords
      .map((r) => parseInt(r.external_reference || "0"))
      .filter((id) => id > 0);

    console.log(`   Already migrated: ${alreadyMigratedIds.length} records`);

    // 2. Get records to migrate
    console.log("\n📊 Fetching records from legacy database...");
    const recordsToMigrate = await legacyExtractor.getRecordsToMigrate(alreadyMigratedIds);
    const totalToMigrate = recordsToMigrate.length;

    if (totalToMigrate === 0) {
      console.log("✅ No new records to migrate. All records are up to date!");
      return;
    }

    console.log(`   Found: ${totalToMigrate} new records to migrate`);
    console.log("━".repeat(60));

    // 3. Create migration batch
    if (!config.dryRun) {
      batchId = await batchCreator.createBatch(totalToMigrate, "system-migration");
      console.log(`📦 Created migration batch: ${batchId}\n`);
    }

    // 4. Process in chunks
    const chunks = chunkArray(recordsToMigrate, config.batchSize);
    console.log(`📦 Processing ${chunks.length} batches of ${config.batchSize} records each\n`);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkStart = chunkIndex * config.batchSize + 1;
      const chunkEnd = Math.min(chunkStart + chunk.length - 1, totalToMigrate);

      console.log(
        `\n🔄 Processing batch ${chunkIndex + 1}/${chunks.length} (records ${chunkStart}-${chunkEnd})`
      );
      console.log("─".repeat(60));

      for (const item of chunk) {
        const { record, verificationSession } = item;

        try {
          // Generate AED UUID first (needed for S3 image paths)
          const { randomUUID } = await import("crypto");
          const aedId = randomUUID();

          // Transform data
          const transformed = transformer.transform(record, verificationSession);

          // Migrate images with the generated aedId
          if (!config.skipImages && imageMigrator) {
            console.log(`  📸 Migrating images for DEA #${record.id}...`);
            transformed.images = await imageMigrator.migrateImages(
              aedId,
              record,
              verificationSession
            );
            console.log(`     ✅ Migrated ${transformed.images.length} images`);
          }

          // Save to database with the pre-generated UUID
          if (!config.dryRun) {
            await saveAed(currentDb, transformed, batchId!, aedId);
          }

          successCount++;
          console.log(`  ✅ DEA #${record.id}: ${record.propuestaDenominacion}`);
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            legacyId: record.id,
            error: errorMessage,
            record: record,
          });
          console.error(`  ❌ DEA #${record.id}: ${errorMessage}`);

          // Log error to database if not dry run
          if (!config.dryRun && batchId) {
            await currentDb.importError.create({
              data: {
                import_batch_id: batchId,
                row_number: record.id,
                record_reference: record.id.toString(),
                error_type: "SYSTEM_ERROR",
                error_message: errorMessage,
                severity: "ERROR",
                row_data: record as any,
              },
            });
          }
        }
      }

      // Update batch progress
      if (!config.dryRun && batchId && chunkIndex % 5 === 0) {
        await batchCreator.updateProgress(batchId, successCount, errorCount);
      }

      console.log(
        `\n✅ Batch ${chunkIndex + 1} complete: ${successCount} success, ${errorCount} errors`
      );
    }

    // 5. Finalize
    const duration = Math.floor((Date.now() - startTime) / 1000);

    if (!config.dryRun && batchId) {
      await batchCreator.completeBatch(batchId, successCount, errorCount, duration);
    }

    console.log("\n" + "━".repeat(60));
    console.log("📊 Migration Summary:");
    console.log(`   Total processed: ${totalToMigrate}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️  Duration: ${formatDuration(duration)}`);
    console.log("━".repeat(60));

    if (errors.length > 0 && errors.length <= 10) {
      console.log("\n❌ Errors:");
      errors.forEach((err) => {
        console.log(`   #${err.legacyId}: ${err.error}`);
      });
    }
  } catch (error) {
    console.error("\n💥 Fatal error:", error);

    if (!config.dryRun && batchId) {
      await batchCreator.failBatch(batchId, error as Error);
    }

    process.exit(1);
  } finally {
    // Cleanup
    await legacyExtractor.close();
    await currentDb.$disconnect();
    if (imageMigrator) {
      await imageMigrator.close();
    }
  }
}

/**
 * Save transformed AED to database
 */
async function saveAed(
  prisma: PrismaClient,
  data: TransformedAed,
  batchId: string,
  aedId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Find or create responsible
    let responsible = await tx.aedResponsible.findFirst({
      where: { name: data.responsible.name },
    });

    if (!responsible) {
      responsible = await tx.aedResponsible.create({
        data: {
          name: data.responsible.name,
          organization: data.responsible.organization,
          ownership: data.responsible.ownership,
          local_use: data.responsible.local_use,
          observations: data.responsible.observations,
        },
      });
    }

    // 2. Create location
    const location = await tx.aedLocation.create({
      data: {
        street_type: data.location.street_type,
        street_name: data.location.street_name,
        street_number: data.location.street_number,
        postal_code: data.location.postal_code,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        district_name: data.location.district_name,
        district_code: data.location.district_code,
        neighborhood_name: data.location.neighborhood_name,
        neighborhood_code: data.location.neighborhood_code,
        city_name: data.location.city_name,
        city_code: data.location.city_code,
        access_description: data.location.access_description,
      },
    });

    // 3. Create schedule
    const schedule = await tx.aedSchedule.create({
      data: {
        description: data.schedule.description,
        has_24h_surveillance: data.schedule.has_24h_surveillance,
        weekday_opening: data.schedule.weekday_opening,
        weekday_closing: data.schedule.weekday_closing,
        saturday_opening: data.schedule.saturday_opening,
        saturday_closing: data.schedule.saturday_closing,
        sunday_opening: data.schedule.sunday_opening,
        sunday_closing: data.schedule.sunday_closing,
      },
    });

    // 4. Create AED with pre-generated UUID (used in S3 image paths)
    const aed = await tx.aed.create({
      data: {
        id: aedId, // Use pre-generated UUID for S3 path consistency
        code: data.aed.code,
        name: data.aed.name,
        establishment_type: data.aed.establishment_type,
        provisional_number: data.aed.provisional_number,
        status: data.aed.status,
        source_origin: data.aed.source_origin,
        external_reference: data.aed.external_reference,
        latitude: data.aed.latitude,
        longitude: data.aed.longitude,
        internal_notes: data.aed.internal_notes,
        origin_observations: data.aed.origin_observations,
        location_id: location.id,
        schedule_id: schedule.id,
        responsible_id: responsible.id,
        import_batch_id: batchId,
      },
    });

    // 5. Create images
    if (data.images.length > 0) {
      await tx.aedImage.createMany({
        data: data.images.map((img) => ({
          aed_id: aed.id,
          type: img.type,
          order: img.order,
          original_url: img.original_url,
          processed_url: img.processed_url,
          width: img.width,
          height: img.height,
          size_bytes: img.size_bytes,
          format: img.format,
          is_verified: img.is_verified,
          verified_at: img.verified_at,
        })),
      });
    }

    // 6. Create validations
    await tx.aedValidation.createMany({
      data: data.validations.map((val) => ({
        aed_id: aed.id,
        type: val.type,
        status: val.status,
        verified_by: val.verified_by,
        completed_at: val.completed_at,
      })),
    });

    // 7. Create address validation
    await tx.aedAddressValidation.create({
      data: {
        location_id: location.id,
        address_found: data.addressValidation.address_found,
        match_level: data.addressValidation.match_level,
        match_type: data.addressValidation.match_type,
        suggested_latitude: data.addressValidation.suggested_latitude,
        suggested_longitude: data.addressValidation.suggested_longitude,
        official_district_code: data.addressValidation.official_district_id?.toString() || null,
        official_neighborhood_code:
          data.addressValidation.official_neighborhood_id?.toString() || null,
      },
    });
  });
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

// Run migration
main().catch(console.error);
