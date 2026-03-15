import { describe, it, expect } from "vitest";
import { ColonNameSplitter } from "@/import/domain/services/ColonNameSplitter";

describe("ColonNameSplitter", () => {
  const splitter = new ColonNameSplitter();

  it("splits name and location on colon", async () => {
    const result = await splitter.transform("EL CORTE INGLÉS TENERIFE: Reserva");
    expect(result.fields.name).toBe("EL CORTE INGLÉS TENERIFE");
    expect(result.fields.specificLocation).toBe("Reserva");
    expect(result.confidence).toBe(0.9);
  });

  it("splits complex location description", async () => {
    const result = await splitter.transform(
      "C.C. MERIDIANO: Planta galería, junto a plaza de Cortefiel"
    );
    expect(result.fields.name).toBe("C.C. MERIDIANO");
    expect(result.fields.specificLocation).toBe("Planta galería, junto a plaza de Cortefiel");
  });

  it("splits on first colon only", async () => {
    const result = await splitter.transform("BANCO: Entrada: Planta baja");
    expect(result.fields.name).toBe("BANCO");
    expect(result.fields.specificLocation).toBe("Entrada: Planta baja");
  });

  it("returns name only when no colon present", async () => {
    const result = await splitter.transform("Hospital Central");
    expect(result.fields.name).toBe("Hospital Central");
    expect(result.fields.specificLocation).toBeUndefined();
    expect(result.confidence).toBe(0.5);
  });

  it("returns confidence 0 for empty input", async () => {
    const result = await splitter.transform("");
    expect(result.confidence).toBe(0);
  });

  it("returns confidence 0 for whitespace-only input", async () => {
    const result = await splitter.transform("   ");
    expect(result.confidence).toBe(0);
  });

  it("handles colon at start (empty name part) → keeps as name", async () => {
    const result = await splitter.transform(": Solo ubicación");
    // colonIdx === 0, so condition colonIdx > 0 is false → falls through
    expect(result.fields.name).toBe(": Solo ubicación");
    expect(result.confidence).toBe(0.5);
  });

  it("handles colon with empty location part → keeps as name", async () => {
    const result = await splitter.transform("Nombre: ");
    // locationPart is empty after trim → falls through
    expect(result.fields.name).toBe("Nombre:");
    expect(result.confidence).toBe(0.5);
  });

  it("preserves rawValue in result", async () => {
    const input = "Test: Value";
    const result = await splitter.transform(input);
    expect(result.rawValue).toBe(input);
  });
});
