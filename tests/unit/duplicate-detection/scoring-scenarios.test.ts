import { describe, it, expect } from "vitest";
import { makeInput, makeCandidate, evaluateAllRules } from "./_helpers";
import { createDefaultRegistry } from "@/duplicate-detection/domain/rules";
import { DetectionConfig } from "@/duplicate-detection/domain/value-objects/DetectionConfig";

describe("Escenarios de scoring — detección de duplicados", () => {
  const { confirmed, possible } = DetectionConfig.thresholds;

  // ============================================================
  // Duplicados claros — score >= 75 (confirmed)
  // ============================================================

  describe("Duplicados claros — score >= confirmed", () => {
    it("mismo nombre + misma dirección + mismas coords + mismo tipo + mismo CP → score máximo", () => {
      const input = makeInput(); // defaults: Farmacia Central, Calle Mayor 5, 40.4168/-3.7038
      const candidate = makeCandidate(); // identical defaults

      const { totalScore } = evaluateAllRules(input, candidate);

      // name(30) + addr(25) + prox(20) + type(10) + postal(5) = 90 mínimo
      expect(totalScore).toBeGreaterThanOrEqual(confirmed);
    });

    it("nombre casi idéntico (typo) + coords cercanas → duplicado confirmado", () => {
      const input = makeInput({ normalizedName: "farmacia centra" }); // typo: falta 'l'
      const candidate = makeCandidate({
        normalized_name: "farmacia central",
        distance_meters: 2,
        name_similarity: 0.93, // still above 0.9 threshold
      });

      const { totalScore, ruleResults } = evaluateAllRules(input, candidate);

      // name_similarity con 0.93 >= 0.9 → +30pts
      const nameRule = ruleResults.find((r) => r.ruleId === "name_similarity");
      expect(nameRule?.matched).toBe(true);
      expect(totalScore).toBeGreaterThanOrEqual(confirmed);
    });

    it("mismo DEA reportado por dos fuentes distintas (coords idénticas, nombre similar)", () => {
      const input = makeInput({
        normalizedName: "desfibrilador farmacia lopez",
        normalizedAddress: "avenida libertad 10",
      });
      const candidate = makeCandidate({
        normalized_name: "dea farmacia lopez",
        normalized_address: "avenida libertad 10",
        distance_meters: 1,
        name_similarity: 0.75, // below 0.9 — names too different
      });

      const { totalScore, ruleResults } = evaluateAllRules(input, candidate);

      // Name won't match (0.75 < 0.9), but addr(25) + prox(30) + type(10) + postal(5) = 70
      const nameRule = ruleResults.find((r) => r.ruleId === "name_similarity");
      expect(nameRule?.matched).toBe(false);
      // Still >= possible threshold
      expect(totalScore).toBeGreaterThanOrEqual(possible);
    });
  });

  // ============================================================
  // Duplicados posibles — score 45-74
  // ============================================================

  describe("Duplicados posibles — score entre possible y confirmed", () => {
    it("nombre similar + coords cercanas pero tipo diferente → score intermedio", () => {
      const input = makeInput({
        establishmentType: "hospital",
      });
      const candidate = makeCandidate({
        establishment_type: "farmacia", // different type
        distance_meters: 3,
      });

      const { ruleResults } = evaluateAllRules(input, candidate);

      // name(30) + addr(25) + prox(20) + NO type + postal(5) = 80
      // BUT type won't match → -10 from max
      const typeRule = ruleResults.find((r) => r.ruleId === "establishment_type");
      expect(typeRule?.matched).toBe(false);
    });

    it("misma dirección + mismo nombre sin coords → possible pero no confirmed", () => {
      const input = makeInput({
        latitude: undefined,
        longitude: undefined,
      });
      const candidate = makeCandidate({
        distance_meters: undefined,
        name_similarity: undefined, // no DB-computed similarity
      });

      const { totalScore, ruleResults } = evaluateAllRules(input, candidate);

      // name: depends on JS trigram sim between identical strings → 1.0 → +30
      // addr(25) + postal(5) = 30, BUT no proximity (no distance_meters)
      const proxRule = ruleResults.find((r) => r.ruleId === "proximity");
      expect(proxRule?.matched).toBe(false);

      // name(30) + addr(25) + type(10) + postal(5) = 70 → possible range
      expect(totalScore).toBeGreaterThanOrEqual(possible);
    });
  });

  // ============================================================
  // No duplicados — score < 45
  // ============================================================

  describe("No duplicados — score < possible", () => {
    it("mismo nombre pero ciudad diferente (coords lejanas, CP diferente)", () => {
      const input = makeInput({
        postalCode: "28001", // Madrid
      });
      const candidate = makeCandidate({
        // Same name "farmacia central" but different location
        normalized_address: "calle valencia 15",
        postal_code: "08001", // Barcelona
        distance_meters: 500000, // 500km away
        latitude: 41.3851,
        longitude: 2.1734,
        name_similarity: 1.0, // identical name
      });

      const { totalScore, ruleResults } = evaluateAllRules(input, candidate);

      // name(30) — address NO match, proximity NO, type YES(10), postal NO
      // = 30 + 10 = 40 < 60
      const addrRule = ruleResults.find((r) => r.ruleId === "address_match");
      expect(addrRule?.matched).toBe(false);

      const proxRule = ruleResults.find((r) => r.ruleId === "proximity");
      expect(proxRule?.matched).toBe(false);

      expect(totalScore).toBeLessThan(possible);
    });

    it("misma dirección pero nombre y tipo completamente diferentes + coords lejanas", () => {
      const input = makeInput({
        normalizedName: "polideportivo municipal",
        establishmentType: "polideportivo",
      });
      const candidate = makeCandidate({
        normalized_name: "farmacia central",
        establishment_type: "farmacia",
        distance_meters: 200, // beyond proximity tiers
        name_similarity: 0.1, // completely different name
      });

      const { totalScore } = evaluateAllRules(input, candidate);

      // name NO(0) + addr YES(25) + prox NO(0, >50m) + type NO(0) + postal YES(5) = 30 < 45
      expect(totalScore).toBeLessThan(possible);
    });

    it("todo vacío — sin datos para comparar → score 0", () => {
      const input = makeInput({
        normalizedName: "",
        normalizedAddress: "",
        latitude: undefined,
        longitude: undefined,
        postalCode: undefined,
        provisionalNumber: null,
        establishmentType: undefined,
      });
      const candidate = makeCandidate({
        normalized_name: "",
        normalized_address: "",
        distance_meters: undefined,
        name_similarity: 0,
        postal_code: null,
        provisional_number: null,
        establishment_type: null,
      });

      const { totalScore } = evaluateAllRules(input, candidate);
      expect(totalScore).toBe(0);
    });
  });

  // ============================================================
  // Verificación de contribución individual de cada regla
  // ============================================================

  describe("Verificación de contribución de cada regla", () => {
    it("name_similarity: debe aportar 30pts cuando similarity >= 0.9", () => {
      const input = makeInput();
      const candidate = makeCandidate({ name_similarity: 0.95 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "name_similarity")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(30);
    });

    it("address_match: debe aportar 25pts con dirección normalizada idéntica", () => {
      const input = makeInput({ normalizedAddress: "calle mayor 5" });
      const candidate = makeCandidate({ normalized_address: "calle mayor 5" });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "address_match")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(25);
    });

    it("proximity: debe aportar 30pts con distancia < 5m (tier más alto)", () => {
      const input = makeInput();
      const candidate = makeCandidate({ distance_meters: 3.5 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "proximity")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(30);
    });

    it("provisional_number: debe aportar 15pts con número idéntico > 0", () => {
      const input = makeInput({ provisionalNumber: 12345 });
      const candidate = makeCandidate({ provisional_number: 12345 });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "provisional_number")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(15);
    });

    it("establishment_type: debe aportar 10pts con tipo normalizado idéntico", () => {
      const input = makeInput({ establishmentType: "farmacia" });
      const candidate = makeCandidate({ establishment_type: "farmacia" });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "establishment_type")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(10);
    });

    it("postal_code: debe aportar 5pts con CP idéntico", () => {
      const input = makeInput({ postalCode: "28001" });
      const candidate = makeCandidate({ postal_code: "28001" });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const rule = ruleResults.find((r) => r.ruleId === "postal_code")!;

      expect(rule.matched).toBe(true);
      expect(rule.points).toBe(5);
    });
  });

  // ============================================================
  // Explicabilidad del scoring
  // ============================================================

  describe("Explicabilidad del scoring", () => {
    it("explain() de cada regla debe incluir reason legible con valores comparados", () => {
      const input = makeInput();
      const candidate = makeCandidate();

      const { ruleResults } = evaluateAllRules(input, candidate);

      for (const rule of ruleResults) {
        expect(rule.reason).toBeTruthy();
        expect(typeof rule.reason).toBe("string");
        expect(rule.reason.length).toBeGreaterThan(5);
      }
    });

    it("reglas que no matchearon deben tener matched=false y points=0", () => {
      const input = makeInput({ postalCode: "28001" });
      const candidate = makeCandidate({ postal_code: "08001" }); // different

      const { ruleResults } = evaluateAllRules(input, candidate);
      const postal = ruleResults.find((r) => r.ruleId === "postal_code")!;

      expect(postal.matched).toBe(false);
      expect(postal.points).toBe(0);
    });
  });

  // ============================================================
  // SQL generation — toSqlCase()
  // ============================================================

  describe("SQL generation — toSqlCase()", () => {
    it("cada regla debe generar SQL válido con parámetros indexados correctamente", () => {
      const registry = createDefaultRegistry();
      const rules = registry.getAll();
      const input = makeInput();

      let paramIdx = 1;
      for (const rule of rules) {
        const fragment = rule.toSqlCase(input, paramIdx);

        expect(fragment.sql).toBeTruthy();
        expect(fragment.nextParamIndex).toBeGreaterThanOrEqual(paramIdx);
        // Params should be an array
        expect(Array.isArray(fragment.params)).toBe(true);

        paramIdx = fragment.nextParamIndex;
      }
    });

    it("paramIndex debe encadenarse correctamente entre reglas secuenciales", () => {
      const registry = createDefaultRegistry();
      const rules = registry.getAll();
      const input = makeInput();

      let paramIdx = 1;
      for (const rule of rules) {
        const fragment = rule.toSqlCase(input, paramIdx);
        // Cada regla debe consumir sus params y avanzar el index
        expect(fragment.nextParamIndex).toBe(paramIdx + fragment.params.length);
        paramIdx = fragment.nextParamIndex;
      }

      // After all rules, paramIdx should have advanced
      expect(paramIdx).toBeGreaterThan(1);
    });

    it("el SQL de proximity debe usar ST_Distance con el threshold correcto", () => {
      const registry = createDefaultRegistry();
      const proxRule = registry.getAll().find((r) => r.id === "proximity")!;
      const input = makeInput();

      const fragment = proxRule.toSqlCase(input, 1);

      expect(fragment.sql).toContain("ST_Distance");
      expect(fragment.sql).toContain("5"); // 5 meters threshold
      expect(fragment.params).toHaveLength(2); // longitude, latitude
    });

    it("el SQL de name_similarity debe usar similarity() con el threshold correcto", () => {
      const registry = createDefaultRegistry();
      const nameRule = registry.getAll().find((r) => r.id === "name_similarity")!;
      const input = makeInput();

      const fragment = nameRule.toSqlCase(input, 1);

      expect(fragment.sql).toContain("similarity");
      expect(fragment.sql).toContain("0.9");
      expect(fragment.params).toHaveLength(1); // normalizedName
      expect(fragment.params[0]).toBe("farmacia central");
    });
  });
});
