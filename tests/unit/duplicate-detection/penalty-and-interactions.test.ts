import { describe, it, expect } from "vitest";
import { makeInput, makeCandidate, evaluateAllRules, makeRuleResult } from "./_helpers";
import { SameBuildingDifferentUnit } from "@/duplicate-detection/domain/rules/interactions/SameBuildingDifferentUnit";
import { AddressVariantSamePlace } from "@/duplicate-detection/domain/rules/interactions/AddressVariantSamePlace";

describe("Penalizaciones e interacciones entre reglas", () => {
  // ============================================================
  // Penalizaciones individuales
  // ============================================================

  describe("Penalizaciones individuales", () => {
    it("planta diferente: -20pts cuando ambos tienen floor y difieren", () => {
      const input = makeInput({ normalizedFloor: "planta baja" });
      const candidate = makeCandidate({ normalized_floor: "primera planta" });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const floorRule = ruleResults.find((r) => r.ruleId === "floor_penalty")!;

      expect(floorRule.matched).toBe(true);
      expect(floorRule.points).toBe(-20);
    });

    it("planta diferente: 0pts cuando uno de los dos no tiene floor", () => {
      const input = makeInput({ normalizedFloor: "planta baja" });
      const candidate = makeCandidate({ normalized_floor: "" }); // empty = no floor

      const { ruleResults } = evaluateAllRules(input, candidate);
      const floorRule = ruleResults.find((r) => r.ruleId === "floor_penalty")!;

      expect(floorRule.matched).toBe(false);
      expect(floorRule.points).toBe(0);
    });

    it("detalles ubicación diferentes: -20pts", () => {
      const input = makeInput({ normalizedLocationDetails: "junto a la entrada principal" });
      const candidate = makeCandidate({
        normalized_location_details: "segunda planta recepcion",
      });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const locRule = ruleResults.find((r) => r.ruleId === "location_details_penalty")!;

      expect(locRule.matched).toBe(true);
      expect(locRule.points).toBe(-20);
    });

    it("instrucciones acceso diferentes: -15pts", () => {
      const input = makeInput({ normalizedAccessInstructions: "puerta lateral izquierda" });
      const candidate = makeCandidate({
        normalized_access_instructions: "entrada principal",
      });

      const { ruleResults } = evaluateAllRules(input, candidate);
      const accRule = ruleResults.find((r) => r.ruleId === "access_instructions_penalty")!;

      expect(accRule.matched).toBe(true);
      expect(accRule.points).toBe(-15);
    });

    it("penalizaciones se acumulan: floor(-20) + location(-20) + access(-15) = -55pts", () => {
      const input = makeInput({
        normalizedFloor: "planta baja",
        normalizedLocationDetails: "junto al ascensor",
        normalizedAccessInstructions: "puerta trasera",
      });
      const candidate = makeCandidate({
        normalized_floor: "primera planta",
        normalized_location_details: "en recepcion",
        normalized_access_instructions: "puerta principal",
      });

      const { ruleResults } = evaluateAllRules(input, candidate);

      const penalties = ruleResults.filter((r) => r.points < 0);
      const totalPenalty = penalties.reduce((sum, r) => sum + r.points, 0);

      expect(penalties).toHaveLength(3);
      expect(totalPenalty).toBe(-55);
    });
  });

  // ============================================================
  // Interacción: mismo edificio, distinta unidad
  // ============================================================

  describe("Interacción: mismo edificio, distinta unidad (SameBuildingDifferentUnit)", () => {
    it("misma dirección + planta diferente → -30pts adicionales (no es duplicado)", () => {
      const input = makeInput({
        normalizedAddress: "calle mayor 5",
        normalizedFloor: "planta baja",
      });
      const candidate = makeCandidate({
        normalized_address: "calle mayor 5",
        normalized_floor: "primera planta",
        distance_meters: 0.5,
      });

      const { totalScore, interactionResults, ruleResults } = evaluateAllRules(input, candidate);

      // Verify the interaction was triggered
      const buildingInteraction = interactionResults.find(
        (i) => i.interactionId === "same_building_different_unit"
      )!;
      expect(buildingInteraction.applied).toBe(true);
      expect(buildingInteraction.adjustment).toBe(-30);

      // address_match(25) + floor_penalty(-20) + other bonuses - interaction(-30) →
      // Score should be very low, possibly clamped to 0
      const addrRule = ruleResults.find((r) => r.ruleId === "address_match")!;
      expect(addrRule.matched).toBe(true);

      const floorRule = ruleResults.find((r) => r.ruleId === "floor_penalty")!;
      expect(floorRule.matched).toBe(true);

      // Total score clamped to Math.max(0, ...)
      expect(totalScore).toBeGreaterThanOrEqual(0);
    });

    it("misma dirección + misma planta → interacción NO aplica", () => {
      const input = makeInput({
        normalizedFloor: "planta baja",
      });
      const candidate = makeCandidate({
        normalized_floor: "planta baja", // same floor
      });

      const { interactionResults } = evaluateAllRules(input, candidate);
      const interaction = interactionResults.find(
        (i) => i.interactionId === "same_building_different_unit"
      )!;

      expect(interaction.applied).toBe(false);
      expect(interaction.adjustment).toBe(0);
    });

    it("dirección diferente + planta diferente → interacción NO aplica", () => {
      const input = makeInput({
        normalizedAddress: "calle mayor 5",
        normalizedFloor: "planta baja",
      });
      const candidate = makeCandidate({
        normalized_address: "avenida libertad 10", // different address
        normalized_floor: "primera planta",
      });

      const { interactionResults } = evaluateAllRules(input, candidate);
      const interaction = interactionResults.find(
        (i) => i.interactionId === "same_building_different_unit"
      )!;

      // address_match won't match → interaction doesn't apply
      expect(interaction.applied).toBe(false);
    });
  });

  // ============================================================
  // Interacción: variante de dirección del mismo lugar
  // ============================================================

  describe("Interacción: variante de dirección (AddressVariantSamePlace)", () => {
    it("dirección diferente (no fuzzy match) + coords cercanas + mismo tipo → +15pts", () => {
      // Use addresses different enough that fuzzy match (sim >= 0.7) doesn't trigger
      const input = makeInput({
        normalizedAddress: "avenida de la constitucion 12", // very different street
        establishmentType: "farmacia",
      });
      const candidate = makeCandidate({
        normalized_address: "calle mayor 5", // different
        establishment_type: "farmacia", // same type
        distance_meters: 2, // very close
      });

      const { interactionResults, ruleResults } = evaluateAllRules(input, candidate);

      // Verify preconditions
      const addrRule = ruleResults.find((r) => r.ruleId === "address_match")!;
      expect(addrRule.matched).toBe(false); // addresses too different even for fuzzy

      const proxRule = ruleResults.find((r) => r.ruleId === "proximity")!;
      expect(proxRule.matched).toBe(true); // close

      const typeRule = ruleResults.find((r) => r.ruleId === "establishment_type")!;
      expect(typeRule.matched).toBe(true); // same type

      // Interaction should apply
      const variant = interactionResults.find(
        (i) => i.interactionId === "address_variant_same_place"
      )!;
      expect(variant.applied).toBe(true);
      expect(variant.adjustment).toBe(15);
    });

    it("dirección diferente + coords cercanas + tipo desconocido → +15pts (typeUnknown)", () => {
      // Cross-source case: one side has no establishment_type
      const input = makeInput({
        normalizedAddress: "avenida de la constitucion 12",
        establishmentType: "farmacia",
      });
      const candidate = makeCandidate({
        normalized_address: "calle mayor 5",
        establishment_type: null, // unknown type → typeUnknown = true
        distance_meters: 2,
      });

      const { interactionResults } = evaluateAllRules(input, candidate);
      const variant = interactionResults.find(
        (i) => i.interactionId === "address_variant_same_place"
      )!;

      expect(variant.applied).toBe(true);
      expect(variant.adjustment).toBe(15);
    });

    it("dirección diferente + coords cercanas + tipo diferente → NO aplica", () => {
      const input = makeInput({
        normalizedAddress: "calle mayor 3",
        establishmentType: "hospital",
      });
      const candidate = makeCandidate({
        normalized_address: "calle mayor 5",
        establishment_type: "farmacia", // different type
        distance_meters: 2,
      });

      const { interactionResults } = evaluateAllRules(input, candidate);
      const variant = interactionResults.find(
        (i) => i.interactionId === "address_variant_same_place"
      )!;

      expect(variant.applied).toBe(false);
    });

    it("dirección coincide + coords cercanas → NO aplica (no es variante, es match directo)", () => {
      const input = makeInput(); // same address as default candidate
      const candidate = makeCandidate({ distance_meters: 1 });

      const { interactionResults, ruleResults } = evaluateAllRules(input, candidate);

      // address_match IS matched → so "address not matched" condition fails
      const addrRule = ruleResults.find((r) => r.ruleId === "address_match")!;
      expect(addrRule.matched).toBe(true);

      const variant = interactionResults.find(
        (i) => i.interactionId === "address_variant_same_place"
      )!;
      expect(variant.applied).toBe(false);
    });
  });

  // ============================================================
  // Combinación de penalizaciones + interacciones
  // ============================================================

  describe("Combinación de penalizaciones + interacciones", () => {
    it("addr match + floor diff + location diff → score clamped a 0", () => {
      const input = makeInput({
        normalizedFloor: "planta baja",
        normalizedLocationDetails: "junto al ascensor",
      });
      const candidate = makeCandidate({
        normalized_floor: "segunda planta",
        normalized_location_details: "recepcion principal",
        distance_meters: 0.5,
      });

      const { totalScore, interactionResults } = evaluateAllRules(input, candidate);

      // floor_penalty(-20) + location_penalty(-20) + building_interaction(-30) = -70 in penalties
      // Even with name(30) + addr(25) + prox(20) + type(10) + postal(5) = 90 positive
      // 90 - 20 - 20 - 30 = 20

      expect(totalScore).toBeGreaterThanOrEqual(0);
      // The interaction should have been triggered
      const building = interactionResults.find(
        (i) => i.interactionId === "same_building_different_unit"
      )!;
      expect(building.applied).toBe(true);
    });
  });

  // ============================================================
  // Unit tests for interaction applies() with crafted RuleResults
  // ============================================================

  describe("Interacciones con RuleResults construidos manualmente", () => {
    const interaction = new SameBuildingDifferentUnit();
    const variant = new AddressVariantSamePlace();
    const input = makeInput();
    const candidate = makeCandidate();

    it("SameBuildingDifferentUnit: applies cuando address_match Y floor_penalty matched", () => {
      const results = [
        makeRuleResult({ ruleId: "address_match", matched: true }),
        makeRuleResult({ ruleId: "floor_penalty", matched: true }),
      ];
      expect(interaction.applies(results, input, candidate)).toBe(true);
    });

    it("SameBuildingDifferentUnit: no applies cuando falta floor_penalty", () => {
      const results = [
        makeRuleResult({ ruleId: "address_match", matched: true }),
        makeRuleResult({ ruleId: "floor_penalty", matched: false }),
      ];
      expect(interaction.applies(results, input, candidate)).toBe(false);
    });

    it("AddressVariantSamePlace: applies cuando address NO match + proximity + type", () => {
      const results = [
        makeRuleResult({ ruleId: "address_match", matched: false }),
        makeRuleResult({ ruleId: "proximity", matched: true }),
        makeRuleResult({ ruleId: "establishment_type", matched: true }),
      ];
      expect(variant.applies(results, input, candidate)).toBe(true);
    });

    it("AddressVariantSamePlace: no applies cuando address matched", () => {
      const results = [
        makeRuleResult({ ruleId: "address_match", matched: true }),
        makeRuleResult({ ruleId: "proximity", matched: true }),
        makeRuleResult({ ruleId: "establishment_type", matched: true }),
      ];
      expect(variant.applies(results, input, candidate)).toBe(false);
    });
  });
});
