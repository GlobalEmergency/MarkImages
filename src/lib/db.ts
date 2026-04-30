import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";
import { existsSync } from "fs";
import { join } from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if branch DB was successfully created during build
const BRANCH_DB_MARKER = join(process.cwd(), ".branch-db-created");

function branchDbWasCreated(): boolean {
  try {
    return existsSync(BRANCH_DB_MARKER);
  } catch {
    return false;
  }
}

/**
 * Gets the appropriate database URL based on the current branch.
 *
 * In Vercel deployments, automatically routes to branch-specific databases
 * when POSTGRES_ADMIN_URL is configured (indicating branch DB feature is enabled).
 *
 * Flow:
 * 1. For main/master branches â†’ use DATABASE_URL as-is
 * 2. For feature branches (claude/*, etc.) â†’ construct branch-specific URL
 * 3. Locally or if feature disabled â†’ use DATABASE_URL as-is
 *
 * IMPORTANT: This only routes to branch DB if BRANCH_DB_CREATED env var is set,
 * which is set by migrate.js when the DB is successfully created.
 */
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;

  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Check if branch database was successfully created during build
  // This prevents runtime from trying to use a DB that doesn't exist
  if (!branchDbWasCreated()) {
    return baseUrl;
  }

  // Check if branch database feature is enabled
  const isVercel = process.env.VERCEL === "1";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "";

  // Production branches use the main database
  const productionBranches = ["main", "master"];
  const isProductionBranch = productionBranches.includes(branch);

  // If not in Vercel or production branch â†’ use default
  if (!isVercel || isProductionBranch || !branch) {
    return baseUrl;
  }

  // Parse the base URL to extract components
  try {
    const parsed = new URL(baseUrl);
    const baseDbName = parsed.pathname.slice(1); // Remove leading /

    // Sanitize branch name for database name
    const sanitizedBranch = branch
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 63 - baseDbName.length - 1); // Leave room for prefix

    // Construct branch database name
    const branchDbName = `${baseDbName}_${sanitizedBranch}`;

    // Build new URL with branch database
    parsed.pathname = `/${branchDbName}`;

    return parsed.toString();
  } catch {
    // If URL parsing fails, fall back to original

    return baseUrl;
  }
}

// Prisma 7 - Requiere adapter obligatorio con el generator prisma-client
const connectionString = getDatabaseUrl();

const adapter = new PrismaPg({ connectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Store instance globally in development
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
