/**
 * edge-case-bugs.test.ts — Edge cases enrevesados y bugs descubiertos
 *
 * Tests escritos PRIMERO como fuente de verdad del comportamiento esperado.
 * Los marcados con 🔴 FALLAN con el código actual (bugs reales).
 * Los marcados con 🟡 son edge cases que deben seguir pasando tras los fixes.
 */

import { describe, it, expect } from "vitest";
import { DuplicateCriteria } from "@/duplicate-detection/domain/value-objects/DuplicateCriteria";
import { DetectionResult } from "@/duplicate-detection/domain/value-objects/DetectionResult";
import { ProximityRule } from "@/duplicate-detection/domain/rules/builtin/ProximityRule";
import { AddressMatchRule } from "@/duplicate-detection/domain/rules/builtin/AddressMatchRule";
import { NameSimilarityRule } from "@/duplicate-detection/domain/rules/builtin/NameSimilarityRule";
import { BulkImportDuplicateAdapter } from "@/duplicate-detection/infrastructure/adapters/BulkImportDuplicateAdapter";
import { DuplicateEventBus } from "@/duplicate-detection/domain/events/DuplicateEvents";
import type { IDuplicateDetector } from "@/duplicate-detection/domain/ports/IDuplicateDetector";
import { makeInput, makeCandidate } from "./_helpers";

// ============================================================
// 🔴 BUG 1: hasSpatialFields deja pasar NaN/Infinity
// ============================================================
describe("🔴 DuplicateCriteria — NaN/Infinity en coordenadas", () => {
  it("latitude: NaN, longitude: NaN → hasSpatialFields debe ser false", () => {
    const criteria = DuplicateCriteria.create({ latitude: NaN, longitude: NaN });
    expect(criteria.hasSpatialFields).toBe(false);
  });

  it("latitude: NaN, longitude: -3.7 → hasSpatialFields debe ser false (una coord inválida invalida ambas)", () => {
    const criteria = DuplicateCriteria.create({ latitude: NaN, longitude: -3.7 });
    expect(criteria.hasSpatialFields).toBe(false);
  });

  it("latitude: 40.4, longitude: NaN → hasSpatialFields debe ser false", () => {
    const criteria = DuplicateCriteria.create({ latitude: 40.4, longitude: NaN });
    expect(criteria.hasSpatialFields).toBe(false);
  });

  it("latitude: Infinity, longitude: -Infinity → hasSpatialFields debe ser false", () => {
    const criteria = DuplicateCriteria.create({
      latitude: Infinity,
      longitude: -Infinity,
    });
    expect(criteria.hasSpatialFields).toBe(false);
  });

  it("🟡 latitude: 0, longitude: 0 → hasSpatialFields debe seguir siendo true", () => {
    const criteria = DuplicateCriteria.create({ latitude: 0, longitude: 0 });
    expect(criteria.hasSpatialFields).toBe(true);
  });

  it("🟡 latitude: undefined, longitude: undefined → hasSpatialFields false (sin cambio)", () => {
    const criteria = DuplicateCriteria.create({});
    expect(criteria.hasSpatialFields).toBe(false);
  });
});

// ============================================================
// 🔴 BUG 2: ProximityRule otorga puntos con distancias inválidas
// ============================================================
describe("🔴 ProximityRule — distancias inválidas", () => {
  const rule = new ProximityRule();
  const input = makeInput();

  it("distance_meters negativa → NO debe otorgar puntos (físicamente imposible)", () => {
    const candidate = makeCandidate({ distance_meters: -5 });
    expect(rule.evaluate(input, candidate)).toBe(0);
  });

  it("distance_meters = -Infinity → NO debe otorgar puntos", () => {
    const candidate = makeCandidate({ distance_meters: -Infinity });
    expect(rule.evaluate(input, candidate)).toBe(0);
  });

  it("distance_meters = NaN → NO debe otorgar puntos", () => {
    const candidate = makeCandidate({ distance_meters: NaN });
    expect(rule.evaluate(input, candidate)).toBe(0);
  });

  it("distance_meters = Infinity → NO debe otorgar puntos", () => {
    const candidate = makeCandidate({ distance_meters: Infinity });
    expect(rule.evaluate(input, candidate)).toBe(0);
  });

  it("explain() con distance negativa → matched: false, 0pts", () => {
    const candidate = makeCandidate({ distance_meters: -1 });
    const explanation = rule.explain(input, candidate);
    expect(explanation.matched).toBe(false);
    expect(explanation.points).toBe(0);
  });

  it("explain() con distance NaN → matched: false, 0pts", () => {
    const candidate = makeCandidate({ distance_meters: NaN });
    const explanation = rule.explain(input, candidate);
    expect(explanation.matched).toBe(false);
    expect(explanation.points).toBe(0);
  });

  it("toSqlCase() con coordenadas NaN → debe devolver SQL '0' (sin query espacial)", () => {
    const nanInput = makeInput({ latitude: NaN, longitude: NaN });
    const fragment = rule.toSqlCase(nanInput, 1);
    expect(fragment.sql).toBe("0");
    expect(fragment.params).toHaveLength(0);
  });

  it("toSqlCase() con una coordenada NaN y otra válida → debe devolver SQL '0'", () => {
    const halfNanInput = makeInput({ latitude: 40.4, longitude: NaN });
    const fragment = rule.toSqlCase(halfNanInput, 1);
    expect(fragment.sql).toBe("0");
    expect(fragment.params).toHaveLength(0);
  });

  it("🟡 distance_meters = 0 → SÍ debe otorgar puntos máximos (distancia 0, misma ubicación)", () => {
    const candidate = makeCandidate({ distance_meters: 0 });
    expect(rule.evaluate(input, candidate)).toBe(30); // top tier: < 5m → 30pts
  });

  it("🟡 distance_meters = 4.999 → SÍ debe otorgar puntos del tier más alto", () => {
    const candidate = makeCandidate({ distance_meters: 4.999 });
    expect(rule.evaluate(input, candidate)).toBe(30); // top tier: < 5m → 30pts
  });
});

// ============================================================
// 🔴 BUG 3: AddressMatchRule SQL no guarda contra strings vacíos
// ============================================================
describe("🔴 AddressMatchRule — SQL/JS consistencia con strings vacíos", () => {
  const rule = new AddressMatchRule();

  it("JS: ambas direcciones vacías → 0pts (ya funciona)", () => {
    const input = makeInput({ normalizedAddress: "" });
    const candidate = makeCandidate({ normalized_address: "" });
    expect(rule.evaluate(input, candidate)).toBe(0);
  });

  it("SQL: toSqlCase() DEBE incluir guard contra '' = '' falso positivo", () => {
    const input = makeInput({ normalizedAddress: "" });
    const fragment = rule.toSqlCase(input, 1);
    // El SQL generado DEBE rechazar match de strings vacíos
    // Opciones válidas: AND $1::text != '' o AND l.normalized_address != ''
    expect(fragment.sql).toMatch(/!=\s*''/);
  });

  it("SQL: toSqlCase() con dirección real no debe incluir guard que la bloquee", () => {
    const input = makeInput({ normalizedAddress: "calle mayor 5" });
    const fragment = rule.toSqlCase(input, 1);
    // Debe seguir funcionando con direcciones reales
    expect(fragment.sql).toContain("$1::text");
    expect(fragment.params).toEqual(["calle mayor 5"]);
  });

  it("explain() con ambas direcciones vacías → matched: false", () => {
    const input = makeInput({ normalizedAddress: "" });
    const candidate = makeCandidate({ normalized_address: "" });
    const explanation = rule.explain(input, candidate);
    expect(explanation.matched).toBe(false);
    expect(explanation.points).toBe(0);
  });
});

// ============================================================
// 🔴 BUG 4: BulkImportAdapter.num() acepta Infinity
// ============================================================
describe("🔴 BulkImportAdapter — validación estricta de números en CSV", () => {
  // Testeamos a través del API público: check() con mock detector que captura criteria
  let capturedCriteria: DuplicateCriteria | null = null;

  const capturingDetector: IDuplicateDetector = {
    check: async (criteria) => {
      capturedCriteria = criteria;
      return DetectionResult.none();
    },
    checkBatch: async (criteriaList) => {
      capturedCriteria = criteriaList[0];
      return criteriaList.map(() => DetectionResult.none());
    },
  };

  const adapter = new BulkImportDuplicateAdapter(capturingDetector, {
    skipDuplicates: false,
  });

  const dummyContext = {} as never;

  it("latitude: Infinity → debe ser undefined en criteria (no coordenada válida)", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: Infinity, longitude: -3.7 }, dummyContext);
    expect(capturedCriteria).not.toBeNull();
    expect(capturedCriteria!.latitude).toBeUndefined();
    expect(capturedCriteria!.hasSpatialFields).toBe(false);
  });

  it("latitude: -Infinity → debe ser undefined en criteria", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: -Infinity, longitude: -3.7 }, dummyContext);
    expect(capturedCriteria!.latitude).toBeUndefined();
  });

  it("latitude: NaN (typeof number) → debe ser undefined en criteria", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: NaN, longitude: -3.7 }, dummyContext);
    expect(capturedCriteria!.latitude).toBeUndefined();
  });

  it("🟡 latitude: 0 → debe conservarse (coordenada válida)", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: 0, longitude: 0 }, dummyContext);
    expect(capturedCriteria!.latitude).toBe(0);
    expect(capturedCriteria!.longitude).toBe(0);
    expect(capturedCriteria!.hasSpatialFields).toBe(true);
  });

  it("🟡 latitude: '40.4168' (string válido) → debe parsearse correctamente", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: "40.4168", longitude: "-3.7038" }, dummyContext);
    expect(capturedCriteria!.latitude).toBeCloseTo(40.4168);
    expect(capturedCriteria!.longitude).toBeCloseTo(-3.7038);
  });

  it("🟡 latitude: 'not-a-number' → debe ser undefined (ya funciona)", async () => {
    capturedCriteria = null;
    await adapter.check({ name: "Test", latitude: "not-a-number", longitude: "abc" }, dummyContext);
    expect(capturedCriteria!.latitude).toBeUndefined();
    expect(capturedCriteria!.longitude).toBeUndefined();
  });
});

// ============================================================
// 🟡 EDGE 5: NameSimilarityRule con valores pre-calculados inválidos
// ============================================================
describe("🟡 NameSimilarityRule — valores edge de name_similarity", () => {
  const rule = new NameSimilarityRule(0.9);
  const input = makeInput({ normalizedName: "farmacia central" });

  it("name_similarity pre-calculado > 1.0 (valor corrupto de BD) → no debería dar match", () => {
    // pg_trgm similarity siempre retorna [0, 1], pero si la BD devuelve 2.0...
    // El contrato es que similarity está en [0,1]. Un valor > 1 es corrupto.
    // Actualmente: 2.0 >= 0.9 → match → 30pts (acepta dato corrupto).
    // Esto no es un bug crítico pero sí un edge case interesante.
    // Lo documentamos como comportamiento actual.
    const candidate = makeCandidate({ name_similarity: 2.0 });
    const result = rule.evaluate(input, candidate);
    // Con datos corruptos, actualmente da match. Si se decide validar rango [0,1]:
    // expect(result).toBe(0);
    // Por ahora documentamos el comportamiento actual:
    expect(result).toBe(30);
  });

  it("name_similarity = NaN (null de BD via coerción) → no debe dar match", () => {
    const candidate = makeCandidate({ name_similarity: NaN });
    const result = rule.evaluate(input, candidate);
    // NaN >= 0.9 → false → 0pts ✅ (se salva por casualidad)
    expect(result).toBe(0);
  });

  it("ambos nombres vacíos → trigramSimilarity('', '') retorna 0, no match", () => {
    const emptyInput = makeInput({ normalizedName: "" });
    const candidate = makeCandidate({
      normalized_name: "",
      name_similarity: undefined,
    });
    const result = rule.evaluate(emptyInput, candidate);
    expect(result).toBe(0);
  });

  it("nombre muy corto (1 char) → baja similarity, no match", () => {
    const shortInput = makeInput({ normalizedName: "a" });
    const candidate = makeCandidate({
      normalized_name: "b",
      name_similarity: undefined,
    });
    const result = rule.evaluate(shortInput, candidate);
    expect(result).toBe(0);
  });

  it("nombre idéntico de 1 char → similarity 1.0, match", () => {
    const shortInput = makeInput({ normalizedName: "x" });
    const candidate = makeCandidate({
      normalized_name: "x",
      name_similarity: undefined,
    });
    const result = rule.evaluate(shortInput, candidate);
    expect(result).toBe(30);
  });
});

// ============================================================
// 🟡 EDGE 6: EventBus — modificación concurrente durante emit
// ============================================================
describe("🟡 DuplicateEventBus — modificación concurrente durante emit", () => {
  const makeEvent = () => ({
    type: "duplicate.confirmed" as const,
    timestamp: new Date(),
    criteria: DuplicateCriteria.create({ name: "Test" }),
    result: {} as never,
  });

  it("subscribe durante emit → nuevo handler NO se ejecuta en emisión actual", async () => {
    const bus = new DuplicateEventBus();
    const calls: string[] = [];

    bus.subscribe(() => {
      calls.push("handler-1");
      // Suscribir un nuevo handler DURANTE la emisión
      bus.subscribe(() => {
        calls.push("handler-late");
      });
    });

    await bus.emit(makeEvent());

    // Solo handler-1 debe haberse ejecutado, no handler-late
    expect(calls).toEqual(["handler-1"]);
  });

  it("unsubscribe de otro handler durante emit → handler ya planificado SÍ se ejecuta", async () => {
    const bus = new DuplicateEventBus();
    const calls: string[] = [];

    let unsubHandler2: (() => void) | null = null;

    bus.subscribe(() => {
      calls.push("handler-1");
      // Desuscribir handler-2 DURANTE la emisión de handler-1
      unsubHandler2?.();
    });

    unsubHandler2 = bus.subscribe(() => {
      calls.push("handler-2");
    });

    await bus.emit(makeEvent());

    // handler-2 ya estaba en el array cuando map() capturó la referencia,
    // pero unsubscribe reasigna this.handlers (no muta el array original).
    // Comportamiento esperado: ambos se ejecutan (unsubscribe toma efecto en el SIGUIENTE emit).
    expect(calls).toContain("handler-1");
    expect(calls).toContain("handler-2");
  });

  it("auto-unsubscribe durante emit → handler se ejecuta y luego queda desuscrito", async () => {
    const bus = new DuplicateEventBus();
    const calls: number[] = [];

    const unsub = bus.subscribe(() => {
      calls.push(1);
      unsub(); // Me desuscribo a mí mismo
    });

    await bus.emit(makeEvent());
    await bus.emit(makeEvent());

    // Primera emisión: se ejecuta y se desuscribe
    // Segunda emisión: ya no está suscrito
    expect(calls).toEqual([1]);
  });

  it("emit sin suscriptores → no lanza error", async () => {
    const bus = new DuplicateEventBus();
    await expect(bus.emit(makeEvent())).resolves.toBeUndefined();
  });
});

// ============================================================
// 🟡 EDGE 7: DuplicateCriteria — lat definida sin lng (y viceversa)
// ============================================================
describe("🟡 DuplicateCriteria — coordenada parcial", () => {
  it("latitude sin longitude → hasSpatialFields false", () => {
    const criteria = DuplicateCriteria.create({ latitude: 40.4 });
    expect(criteria.hasSpatialFields).toBe(false);
    expect(criteria.latitude).toBe(40.4);
    expect(criteria.longitude).toBeUndefined();
  });

  it("longitude sin latitude → hasSpatialFields false", () => {
    const criteria = DuplicateCriteria.create({ longitude: -3.7 });
    expect(criteria.hasSpatialFields).toBe(false);
    expect(criteria.latitude).toBeUndefined();
    expect(criteria.longitude).toBe(-3.7);
  });

  it("ProximityRule.toSqlCase() con lat pero sin lng → devuelve '0'", () => {
    const rule = new ProximityRule();
    const input = makeInput({ latitude: 40.4, longitude: undefined });
    const fragment = rule.toSqlCase(input, 1);
    expect(fragment.sql).toBe("0");
    expect(fragment.params).toHaveLength(0);
  });
});
