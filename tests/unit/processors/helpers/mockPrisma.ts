/**
 * Shared Prisma mock factory for processor tests.
 *
 * Creates a mock PrismaClient where every model method returns a spy.
 * The $transaction mock executes the callback with the mock itself (tx === prisma).
 */
import { randomUUID } from "node:crypto";
import { vi } from "vitest";

/** Shape returned by create/update calls — just needs an id */
const defaultCreated = (overrides?: Record<string, unknown>) => ({
  id: randomUUID(),
  ...overrides,
});

export function createMockPrisma() {
  const mockModel = () => ({
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve(defaultCreated(data))),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve(defaultCreated(data))),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(defaultCreated(create))),
  });

  const prisma = {
    aed: mockModel(),
    aedLocation: mockModel(),
    aedSchedule: mockModel(),
    aedResponsible: mockModel(),
    aedDevice: mockModel(),
    aedOrganizationAssignment: mockModel(),
    aedFieldChange: mockModel(),
    externalDataSource: mockModel(),
    batchJob: mockModel(),
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };

  // $transaction executes the callback with the prisma mock as tx
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
    return fn(prisma);
  });

  return prisma;
}

export function createMockContext(
  overrides?: Partial<{
    jobId: string;
    batchId: string;
    batchIndex: number;
    recordIndex: number;
    totalRecords: number;
  }>
) {
  return {
    jobId: "test-job-id",
    batchId: "test-batch-id",
    batchIndex: 0,
    recordIndex: 0,
    totalRecords: 1,
    signal: new AbortController().signal,
    ...overrides,
  };
}
