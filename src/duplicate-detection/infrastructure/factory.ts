/**
 * Factory — Singleton and custom detector creation
 *
 * getDuplicateDetector(): Returns a process-level singleton with default config.
 *   Uses globalThis to survive Next.js hot reload in development.
 * createDuplicateDetector(): Creates a custom instance (for tests or variant flows).
 */

import type { PrismaClient } from "@/generated/client/client";
import { prisma } from "@/lib/db";
import { DuplicateDetectorService } from "../application/DuplicateDetectorService";
import { createDefaultRegistry } from "../domain/rules";
import type { RuleRegistry } from "../domain/rules/RuleRegistry";
import { duplicateEventBus } from "../domain/events/DuplicateEvents";
import { PrismaIdentityMatcher } from "./PrismaIdentityMatcher";
import { PostgisScoringEngine } from "./PostgisScoringEngine";
import { TextNormalizer } from "./TextNormalizer";

/**
 * Use globalThis to keep a single instance across Next.js hot reloads
 * (same pattern as the Prisma client in src/lib/db.ts).
 */
const globalForDetector = globalThis as unknown as {
  _duplicateDetector?: DuplicateDetectorService;
};

/**
 * Get the process-level singleton DuplicateDetectorService.
 * Uses default rule registry (9 rules + 2 interactions) and global Prisma client.
 *
 * In serverless (Vercel), this provides per-Lambda reuse within a cold-start lifecycle.
 * In dev, globalThis survives HMR so the same instance is shared across hot reloads.
 */
export function getDuplicateDetector(): DuplicateDetectorService {
  if (!globalForDetector._duplicateDetector) {
    globalForDetector._duplicateDetector = new DuplicateDetectorService(
      new PrismaIdentityMatcher(prisma),
      new PostgisScoringEngine(prisma),
      new TextNormalizer(),
      createDefaultRegistry(),
      duplicateEventBus
    );
  }
  return globalForDetector._duplicateDetector;
}

/**
 * Create a custom DuplicateDetectorService instance.
 * Useful for: tests with mock Prisma, flows with custom rule registries.
 */
export function createDuplicateDetector(
  registry: RuleRegistry,
  prismaClient?: PrismaClient
): DuplicateDetectorService {
  const client = prismaClient ?? prisma;
  return new DuplicateDetectorService(
    new PrismaIdentityMatcher(client),
    new PostgisScoringEngine(client),
    new TextNormalizer(),
    registry,
    duplicateEventBus
  );
}

/** Reset singleton (for testing only) */
export function _resetDuplicateDetector(): void {
  globalForDetector._duplicateDetector = undefined;
}
