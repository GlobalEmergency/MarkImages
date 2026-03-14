import { describe, it, expect, beforeEach } from "vitest";
import { TransformerPipeline } from "@/import/infrastructure/transformers/TransformerPipeline";
import { TransformerRegistry } from "@/import/infrastructure/transformers/TransformerRegistry";
import type { IFieldTransformer, TransformerResult } from "@/import/domain/ports/IFieldTransformer";

/** Simple mock transformer for testing */
class MockTransformer implements IFieldTransformer {
  constructor(
    readonly name: string,
    private result: TransformerResult
  ) {}

  async transform(): Promise<TransformerResult> {
    return this.result;
  }
}

/** Transformer that always throws */
class FailingTransformer implements IFieldTransformer {
  readonly name = "failing";

  async transform(): Promise<TransformerResult> {
    throw new Error("Service unavailable");
  }
}

describe("TransformerPipeline", () => {
  let registry: TransformerRegistry;
  let pipeline: TransformerPipeline;

  beforeEach(() => {
    TransformerRegistry.resetForTesting();
    registry = TransformerRegistry.getInstance();
    pipeline = new TransformerPipeline(registry);
  });

  it("enriches record with transformer fields", async () => {
    registry.register(
      new MockTransformer("test-schedule", {
        fields: { weekdayOpening: "09:00", weekdayClosing: "18:00" },
        confidence: 0.8,
        rawValue: "test",
      })
    );

    const record = { horario: "DE 09:00 A 18:00", municipio: "Madrid" };
    const fieldMappings = { horario: "accessSchedule", municipio: "city" };
    const fieldTransformers = { horario: ["test-schedule"] };

    const { enrichedRecord, enrichedMappings } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    // Original record fields preserved
    expect(enrichedRecord.horario).toBe("DE 09:00 A 18:00");
    expect(enrichedRecord.municipio).toBe("Madrid");

    // Transformer fields added with _t_ prefix
    expect(enrichedRecord._t_weekdayOpening).toBe("09:00");
    expect(enrichedRecord._t_weekdayClosing).toBe("18:00");

    // Identity mappings created for transformer fields
    expect(enrichedMappings._t_weekdayOpening).toBe("weekdayOpening");
    expect(enrichedMappings._t_weekdayClosing).toBe("weekdayClosing");

    // Original mappings preserved
    expect(enrichedMappings.horario).toBe("accessSchedule");
    expect(enrichedMappings.municipio).toBe("city");
  });

  it("chains multiple transformers", async () => {
    registry.register(
      new MockTransformer("first", {
        fields: { field1: "value1" },
        confidence: 0.8,
        rawValue: "test",
      })
    );
    registry.register(
      new MockTransformer("second", {
        fields: { field2: "value2" },
        confidence: 0.9,
        rawValue: "test",
      })
    );

    const record = { input: "some text" };
    const fieldMappings = { input: "raw" };
    const fieldTransformers = { input: ["first", "second"] };

    const { enrichedRecord } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    expect(enrichedRecord._t_field1).toBe("value1");
    expect(enrichedRecord._t_field2).toBe("value2");
  });

  it("keeps fallback when transformer fails", async () => {
    registry.register(new FailingTransformer());

    const record = { address: "Calle Mayor 1" };
    const fieldMappings = { address: "streetName" };
    const fieldTransformers = { address: ["failing"] };

    const { enrichedRecord, enrichedMappings } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    // No enrichment happened
    expect(Object.keys(enrichedRecord).filter((k) => k.startsWith("_t_"))).toHaveLength(0);

    // Original mapping preserved (fallback)
    expect(enrichedMappings.address).toBe("streetName");
  });

  it("skips null/undefined/empty values", async () => {
    registry.register(
      new MockTransformer("test", {
        fields: { parsed: "value" },
        confidence: 1,
        rawValue: "test",
      })
    );

    const record = { empty: "", nullVal: null, missing: undefined };
    const fieldMappings = {};
    const fieldTransformers = {
      empty: ["test"],
      nullVal: ["test"],
      missing: ["test"],
    };

    const { enrichedRecord } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    // None of the transformer fields should be added
    expect(Object.keys(enrichedRecord).filter((k) => k.startsWith("_t_"))).toHaveLength(0);
  });

  it("ignores unregistered transformers", async () => {
    const record = { field: "value" };
    const fieldMappings = { field: "mapped" };
    const fieldTransformers = { field: ["nonexistent"] };

    const { enrichedRecord } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    expect(Object.keys(enrichedRecord).filter((k) => k.startsWith("_t_"))).toHaveLength(0);
  });

  it("skips fields with confidence 0", async () => {
    registry.register(
      new MockTransformer("low-conf", {
        fields: { parsed: "value" },
        confidence: 0,
        rawValue: "test",
      })
    );

    const record = { field: "value" };
    const fieldMappings = { field: "mapped" };
    const fieldTransformers = { field: ["low-conf"] };

    const { enrichedRecord } = await pipeline.enrichRecord(
      record,
      fieldTransformers,
      fieldMappings
    );

    expect(Object.keys(enrichedRecord).filter((k) => k.startsWith("_t_"))).toHaveLength(0);
  });
});
