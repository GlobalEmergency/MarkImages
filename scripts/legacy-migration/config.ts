/**
 * Configuration for Legacy Migration
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export interface MigrationConfig {
  // Databases
  legacyDatabaseUrl: string;
  currentDatabaseUrl: string;

  // S3
  s3Bucket: string;
  s3Region: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;

  // Migration options
  batchSize: number;
  dryRun: boolean;
  skipImages: boolean;

  // Logging
  verbose: boolean;
}

export function loadConfig(): MigrationConfig {
  const config: MigrationConfig = {
    legacyDatabaseUrl: process.env.LEGACY_DATABASE_URL || "",
    currentDatabaseUrl: process.env.DATABASE_URL || "",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_REGION || "eu-west-1",
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    batchSize: parseInt(process.env.MIGRATION_BATCH_SIZE || "10"),
    dryRun: process.env.MIGRATION_DRY_RUN === "true",
    skipImages: process.env.MIGRATION_SKIP_IMAGES === "true",
    verbose: process.env.MIGRATION_VERBOSE === "true",
  };

  // Validate required fields
  const requiredFields = ["legacyDatabaseUrl", "currentDatabaseUrl"];

  if (!config.skipImages) {
    requiredFields.push("s3Bucket", "awsAccessKeyId", "awsSecretAccessKey");
  }

  for (const field of requiredFields) {
    if (!config[field as keyof MigrationConfig]) {
      throw new Error(`Missing required configuration: ${field}`);
    }
  }

  return config;
}

export function parseCommandLineArgs(): Partial<MigrationConfig> {
  const args = process.argv.slice(2);
  const config: Partial<MigrationConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--skip-images") {
      config.skipImages = true;
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true;
    } else if (arg === "--batch-size" && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1]);
      i++;
    }
  }

  return config;
}
