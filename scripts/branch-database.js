#!/usr/bin/env node

/**
 * Branch Database Manager
 *
 * Creates and manages separate PostgreSQL databases for each git branch.
 * This allows isolated development environments with dummy data.
 *
 * Required environment variables:
 * - DATABASE_URL: Production database URL (parsed for credentials)
 * - POSTGRES_ADMIN_URL: Admin connection to create databases (e.g., postgres user)
 *
 * Optional:
 * - PRODUCTION_DATABASE_NAME: Override base name for databases (default: extracted from DATABASE_URL)
 *
 * How it works:
 * 1. Parses DATABASE_URL to extract: host, port, user, password, database name
 * 2. Uses POSTGRES_ADMIN_URL to create new databases
 * 3. Builds new DATABASE_URL for branch using same credentials but different DB name
 *
 * Example:
 * - DATABASE_URL: postgresql://app:secret@host:5432/samur_dea
 * - Branch: claude/feature-xyz
 * - New DB: samur_dea_claude_feature_xyz
 * - New URL: postgresql://app:secret@host:5432/samur_dea_claude_feature_xyz
 */

const { Client } = require("pg");

/**
 * Parses a PostgreSQL connection URL
 * Returns: { host, port, user, password, database }
 */
function parseDatabaseUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: parsed.username,
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1), // Remove leading /
    };
  } catch {
    console.error("Failed to parse DATABASE_URL");
    return null;
  }
}

// Parse DATABASE_URL for configuration
const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

// Configuration
const CONFIG = {
  // Branches that should use the main production database
  productionBranches: ["main", "master"],

  // Prefix for branch databases (from DATABASE_URL or override)
  dbPrefix: process.env.PRODUCTION_DATABASE_NAME || dbConfig?.database || "samur_dea",

  // Max database name length in PostgreSQL
  maxDbNameLength: 63,

  // Parsed credentials from DATABASE_URL
  credentials: dbConfig,
};

/**
 * Sanitizes a branch name to be a valid PostgreSQL database name
 * PostgreSQL identifiers: lowercase, alphanumeric + underscore, max 63 chars
 */
function sanitizeBranchName(branch) {
  if (!branch) return null;

  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_") // Replace non-alphanumeric with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores

  // Truncate to fit within max length (leaving room for prefix)
  const maxSuffixLength = CONFIG.maxDbNameLength - CONFIG.dbPrefix.length - 1;
  return sanitized.substring(0, maxSuffixLength);
}

/**
 * Generates the database name for a given branch
 */
function getDatabaseName(branch) {
  if (!branch || CONFIG.productionBranches.includes(branch)) {
    return CONFIG.dbPrefix;
  }

  const sanitized = sanitizeBranchName(branch);
  if (!sanitized) {
    return CONFIG.dbPrefix;
  }

  return `${CONFIG.dbPrefix}_${sanitized}`;
}

/**
 * Checks if branch database feature is enabled
 * Requires: DATABASE_URL (for credentials) and POSTGRES_ADMIN_URL (to create DBs)
 */
function isFeatureEnabled() {
  return !!(process.env.POSTGRES_ADMIN_URL && CONFIG.credentials);
}

/**
 * Gets the current git branch from environment
 */
function getCurrentBranch() {
  return process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || "";
}

/**
 * Determines if we should create a branch-specific database
 */
function shouldCreateBranchDatabase() {
  const branch = getCurrentBranch();
  const isVercel = process.env.VERCEL === "1";

  // Only in Vercel environment
  if (!isVercel) return false;

  // Feature must be enabled
  if (!isFeatureEnabled()) return false;

  // Don't create for production branches
  if (CONFIG.productionBranches.includes(branch)) return false;

  // Must have a valid branch name
  if (!branch) return false;

  return true;
}

/**
 * Checks if a database exists
 */
async function databaseExists(adminClient, dbName) {
  const result = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  return result.rows.length > 0;
}

/**
 * Creates a new database and grants permissions to the app user
 */
async function createDatabase(adminUrl, dbName) {
  // First, create the database
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();

  try {
    const safeName = dbName.replace(/"/g, '""');
    await adminClient.query(`CREATE DATABASE "${safeName}"`);
  } finally {
    await adminClient.end();
  }

  // Now connect to the new database and grant permissions
  const appUser = CONFIG.credentials?.user;
  if (appUser) {
    // Parse admin URL and replace database name
    const parsedAdminUrl = new URL(adminUrl);
    parsedAdminUrl.pathname = `/${dbName}`;

    const newDbClient = new Client({ connectionString: parsedAdminUrl.toString() });
    await newDbClient.connect();

    try {
      const safeUser = appUser.replace(/"/g, '""');
      // Grant all privileges on the new database
      await newDbClient.query(
        `GRANT ALL PRIVILEGES ON DATABASE "${dbName.replace(/"/g, '""')}" TO "${safeUser}"`
      );
      // Grant usage and create on public schema
      await newDbClient.query(`GRANT ALL ON SCHEMA public TO "${safeUser}"`);
      // Make app user owner of public schema so it can create tables
      await newDbClient.query(`ALTER SCHEMA public OWNER TO "${safeUser}"`);
      console.log(`   ✅ Permissions granted to user: ${appUser}`);

      //   ENABLE EXTENSIONS
      //   POSTGIS
      await newDbClient.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
      console.log(`   ✅ PostGIS extension enabled`);
      //   UUID-OSSP
      await newDbClient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      console.log(`   ✅ uuid-ossp extension enabled`);
      //     postgres search
      await newDbClient.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      console.log(`   ✅ pg_trgm extension enabled`);
    } finally {
      await newDbClient.end();
    }
  }
}

/**
 * Builds the DATABASE_URL for the application
 * Uses credentials parsed from the original DATABASE_URL
 */
function buildDatabaseUrl(dbName) {
  if (!CONFIG.credentials) {
    throw new Error("Cannot build database URL: DATABASE_URL not configured");
  }

  const { host, port, user, password } = CONFIG.credentials;

  // URL encode the password in case it has special characters
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${dbName}`;
}

/**
 * Main function: Creates branch database if needed
 * Returns { isNewDatabase: boolean, databaseUrl: string, databaseName: string }
 */
async function createBranchDatabaseIfNeeded() {
  const branch = getCurrentBranch();
  const dbName = getDatabaseName(branch);

  console.log(`🔍 Branch Database Check:`);
  console.log(`   - Branch: ${branch}`);
  console.log(`   - Target database: ${dbName}`);

  // If feature not enabled, return the default DATABASE_URL
  if (!isFeatureEnabled()) {
    console.log(`   - Feature not enabled, using DATABASE_URL`);
    return {
      isNewDatabase: false,
      databaseUrl: process.env.DATABASE_URL,
      databaseName: null,
    };
  }

  // If production branch, use default DATABASE_URL
  if (CONFIG.productionBranches.includes(branch)) {
    console.log(`   - Production branch, using DATABASE_URL`);
    return {
      isNewDatabase: false,
      databaseUrl: process.env.DATABASE_URL,
      databaseName: dbName,
    };
  }

  // Connect to PostgreSQL as admin
  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    // Check if database exists
    const exists = await databaseExists(adminClient, dbName);

    if (exists) {
      console.log(`   ✅ Database exists, reusing it`);
      return {
        isNewDatabase: false,
        databaseUrl: buildDatabaseUrl(dbName),
        databaseName: dbName,
      };
    }

    // Create new database
    console.log(`   📦 Creating new database...`);
    await createDatabase(process.env.POSTGRES_ADMIN_URL, dbName);
    console.log(`   ✅ Database created: ${dbName}`);

    return {
      isNewDatabase: true,
      databaseUrl: buildDatabaseUrl(dbName),
      databaseName: dbName,
    };
  } finally {
    await adminClient.end();
  }
}

/**
 * Lists all branch databases (for cleanup purposes)
 */
async function listBranchDatabases() {
  if (!process.env.POSTGRES_ADMIN_URL) {
    throw new Error("POSTGRES_ADMIN_URL is required");
  }

  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    const result = await adminClient.query(
      `SELECT datname FROM pg_database
       WHERE datname LIKE $1
       AND datname != $2
       ORDER BY datname`,
      [`${CONFIG.dbPrefix}_%`, CONFIG.dbPrefix]
    );

    return result.rows.map((row) => row.datname);
  } finally {
    await adminClient.end();
  }
}

/**
 * Drops a branch database (use with caution!)
 */
async function dropBranchDatabase(dbName) {
  if (!process.env.POSTGRES_ADMIN_URL) {
    throw new Error("POSTGRES_ADMIN_URL is required");
  }

  // Safety check: don't drop production database
  if (dbName === CONFIG.dbPrefix) {
    throw new Error("Cannot drop production database");
  }

  // Safety check: must start with prefix
  if (!dbName.startsWith(`${CONFIG.dbPrefix}_`)) {
    throw new Error(`Invalid database name: ${dbName}`);
  }

  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    // Terminate existing connections
    await adminClient.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );

    // Drop database
    const safeName = dbName.replace(/"/g, '""');
    await adminClient.query(`DROP DATABASE IF EXISTS "${safeName}"`);

    console.log(`✅ Dropped database: ${dbName}`);
  } finally {
    await adminClient.end();
  }
}

// Export functions for use in migrate.js
module.exports = {
  sanitizeBranchName,
  getDatabaseName,
  isFeatureEnabled,
  getCurrentBranch,
  shouldCreateBranchDatabase,
  createBranchDatabaseIfNeeded,
  buildDatabaseUrl,
  listBranchDatabases,
  dropBranchDatabase,
};

// CLI interface when run directly
if (require.main === module) {
  const command = process.argv[2];

  async function main() {
    switch (command) {
      case "check":
        console.log("🔍 Branch Database Configuration\n");
        console.log("Feature enabled:", isFeatureEnabled() ? "✅" : "❌");
        console.log("Current branch:", getCurrentBranch() || "(not set)");
        console.log("Target database:", getDatabaseName(getCurrentBranch()));
        console.log("Should create:", shouldCreateBranchDatabase() ? "✅" : "❌");
        console.log("\n📦 Credentials (from DATABASE_URL):");
        if (CONFIG.credentials) {
          console.log("  Host:", CONFIG.credentials.host);
          console.log("  Port:", CONFIG.credentials.port);
          console.log("  User:", CONFIG.credentials.user);
          console.log("  Password:", CONFIG.credentials.password ? "****" : "(not set)");
          console.log("  Database:", CONFIG.credentials.database);
        } else {
          console.log("  ❌ DATABASE_URL not configured or invalid");
        }
        console.log(
          "\n🔑 Admin URL:",
          process.env.POSTGRES_ADMIN_URL ? "✅ configured" : "❌ not set"
        );
        break;

      case "create":
        const result = await createBranchDatabaseIfNeeded();
        console.log("Result:", JSON.stringify(result, null, 2));
        break;

      case "list":
        const databases = await listBranchDatabases();
        console.log("Branch databases:");
        databases.forEach((db) => console.log(`  - ${db}`));
        break;

      case "drop":
        const dbToDrop = process.argv[3];
        if (!dbToDrop) {
          console.error("Usage: branch-database.js drop <database-name>");
          process.exit(1);
        }
        await dropBranchDatabase(dbToDrop);
        break;

      default:
        console.log(`
Branch Database Manager

Usage:
  node branch-database.js check   - Check current configuration
  node branch-database.js create  - Create database for current branch
  node branch-database.js list    - List all branch databases
  node branch-database.js drop <name> - Drop a branch database

Environment variables required:
  DATABASE_URL            - Production database URL (credentials are extracted from here)
  POSTGRES_ADMIN_URL      - Admin connection string (e.g., postgres superuser)

Optional:
  PRODUCTION_DATABASE_NAME - Override base database name (default: from DATABASE_URL)

Example:
  DATABASE_URL=postgresql://app:secret@host:5432/samur_dea
  POSTGRES_ADMIN_URL=postgresql://postgres:admin@host:5432/postgres

  Branch: claude/feature-xyz
  Creates: samur_dea_claude_feature_xyz
`);
    }
  }

  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
