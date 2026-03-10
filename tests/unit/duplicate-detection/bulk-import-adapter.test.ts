import { describe, it, expect, beforeEach } from "vitest";
import { BulkImportDuplicateAdapter } from "@/duplicate-detection/infrastructure/adapters/BulkImportDuplicateAdapter";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { DetectionResult } from "@/duplicate-detection/domain/value-objects/DetectionResult";
import { ScoringExplanation } from "@/duplicate-detection/domain/value-objects/ScoringExplanation";
import type { IDuplicateDetector } from "@/duplicate-detection/domain/ports/IDuplicateDetector";

// ─── Mock detector ─────────────────────────────────────────────

class MockDetector implements IDuplicateDetector {
  lastCriteria: DuplicateCriteria | null = null;
  lastBatch: readonly DuplicateCriteria[] = [];
  result: DetectionResult = DetectionResult.none();
  batchResults: DetectionResult[] = [];

  async check(criteria: DuplicateCriteria): Promise<DetectionResult> {
    this.lastCriteria = criteria;
    return this.result;
  }

  async checkBatch(
    criteriaList: readonly DuplicateCriteria[]
  ): Promise<readonly DetectionResult[]> {
    this.lastBatch = criteriaList;
    return this.batchResults.length > 0 ? this.batchResults : criteriaList.map(() => this.result);
  }
}

// ─── Tests ─────────────────────────────────────────────────────

describe("BulkImportDuplicateAdapter — integración con pipeline CSV", () => {
  let detector: MockDetector;

  beforeEach(() => {
    detector = new MockDetector();
  });

  // ============================================================
  // Mapeo de campos CSV a DuplicateCriteria
  // ============================================================

  describe("Mapeo de campos CSV a DuplicateCriteria", () => {
    it("debe mapear name, latitude, longitude, code, externalId desde fields", async () => {
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      await adapter.check(
        {
          name: "Farmacia Central",
          latitude: "40.4168",
          longitude: "-3.7038",
          code: "DEA-001",
          externalReference: "EXT-001",
        },
        {} as never // ProcessingContext stub
      );

      const c = detector.lastCriteria!;
      expect(c.name).toBe("Farmacia Central");
      expect(c.latitude).toBeCloseTo(40.4168);
      expect(c.longitude).toBeCloseTo(-3.7038);
      expect(c.code).toBe("DEA-001");
      expect(c.externalReference).toBe("EXT-001");
    });

    it("debe mapear streetType, streetName, streetNumber, postalCode", async () => {
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      await adapter.check(
        {
          streetType: "Calle",
          streetName: "Mayor",
          streetNumber: "5",
          postalCode: "28001",
        },
        {} as never
      );

      const c = detector.lastCriteria!;
      expect(c.streetType).toBe("Calle");
      expect(c.streetName).toBe("Mayor");
      expect(c.streetNumber).toBe("5");
      expect(c.postalCode).toBe("28001");
    });

    it("debe manejar campos faltantes como undefined (no error)", async () => {
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      await adapter.check({ name: "Only name" }, {} as never);

      const c = detector.lastCriteria!;
      expect(c.name).toBe("Only name");
      expect(c.code).toBeUndefined();
      expect(c.latitude).toBeUndefined();
      expect(c.longitude).toBeUndefined();
      expect(c.streetType).toBeUndefined();
    });

    it("debe convertir latitude/longitude string a number", async () => {
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      await adapter.check({ latitude: "40.4168", longitude: "-3.7038" }, {} as never);

      const c = detector.lastCriteria!;
      expect(typeof c.latitude).toBe("number");
      expect(typeof c.longitude).toBe("number");
    });
  });

  // ============================================================
  // Resultados de detección → formato BulkImport
  // ============================================================

  describe("Resultados de detección → formato BulkImport", () => {
    it("no duplicado → { isDuplicate: false }", async () => {
      detector.result = DetectionResult.none();
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      const result = await adapter.check({ name: "New AED" }, {} as never);

      expect(result.isDuplicate).toBe(false);
    });

    it("duplicado confirmado → { isDuplicate: true, existingId, metadata }", async () => {
      detector.result = DetectionResult.confirmedByIdentity("aed-123", "code");
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      const result = await adapter.check({ code: "DEA-001" }, {} as never);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe("aed-123");
      expect(result.metadata?.matchedBy).toBe("code");
      expect(result.metadata?.score).toBe(100);
    });

    it("duplicado possible con scoring → metadata incluye explanation", async () => {
      const explanation = ScoringExplanation.create({
        totalScore: 65,
        maxPossibleScore: 115,
        ruleResults: [],
        interactionResults: [],
        matchedAedId: "aed-456",
        matchedAedName: "Test",
        searchStrategy: "coordinates",
        distanceMeters: 3.0,
      });
      detector.result = DetectionResult.possible("aed-456", explanation);
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: true });

      const result = await adapter.check(
        { name: "Test", latitude: 40, longitude: -3 },
        {} as never
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.metadata?.score).toBe(65);
      expect(result.metadata?.status).toBe("possible");
      expect(result.metadata?.explanation).toBeDefined();
    });
  });

  // ============================================================
  // Opción skipDuplicates
  // ============================================================

  describe("Opción skipDuplicates", () => {
    it("skipDuplicates=true se propaga en metadata del resultado", async () => {
      detector.result = DetectionResult.confirmedByIdentity("aed-1", "id");
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: true });

      const result = await adapter.check({ id: "aed-1" }, {} as never);

      expect(result.metadata?.skipDuplicates).toBe(true);
    });

    it("skipDuplicates=false se propaga en metadata del resultado", async () => {
      detector.result = DetectionResult.confirmedByIdentity("aed-1", "id");
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      const result = await adapter.check({ id: "aed-1" }, {} as never);

      expect(result.metadata?.skipDuplicates).toBe(false);
    });
  });

  // ============================================================
  // Batch
  // ============================================================

  describe("Batch processing", () => {
    it("debe procesar batch de registros correctamente", async () => {
      detector.batchResults = [
        DetectionResult.confirmedByIdentity("aed-1", "code"),
        DetectionResult.none(),
        DetectionResult.none(),
      ];
      const adapter = new BulkImportDuplicateAdapter(detector, { skipDuplicates: false });

      const results = await adapter.checkBatch([
        { fields: { code: "DEA-001" }, context: {} as never },
        { fields: { name: "New 1" }, context: {} as never },
        { fields: { name: "New 2" }, context: {} as never },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].isDuplicate).toBe(true);
      expect(results[1].isDuplicate).toBe(false);
      expect(results[2].isDuplicate).toBe(false);

      // Verify all 3 criteria were sent to detector
      expect(detector.lastBatch).toHaveLength(3);
    });
  });
});
