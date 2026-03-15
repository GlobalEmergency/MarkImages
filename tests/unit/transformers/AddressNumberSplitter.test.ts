import { describe, it, expect } from "vitest";
import { AddressNumberSplitter } from "@/import/domain/services/AddressNumberSplitter";

describe("AddressNumberSplitter", () => {
  const parser = new AddressNumberSplitter();

  it("splits 'Thys-Vanhamstraat 21'", async () => {
    const result = await parser.transform("Thys-Vanhamstraat 21");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Thys-Vanhamstraat");
    expect(result.fields.streetNumber).toBe("21");
  });

  it("splits 'Kerkeveldstraat 73/89'", async () => {
    const result = await parser.transform("Kerkeveldstraat 73/89");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Kerkeveldstraat");
    expect(result.fields.streetNumber).toBe("73/89");
  });

  it("splits 'Rue de la Loi 155'", async () => {
    const result = await parser.transform("Rue de la Loi 155");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Rue de la Loi");
    expect(result.fields.streetNumber).toBe("155");
  });

  it("splits 'Avenue Louise 235-245'", async () => {
    const result = await parser.transform("Avenue Louise 235-245");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Avenue Louise");
    expect(result.fields.streetNumber).toBe("235-245");
  });

  it("splits 'Pl. du Grand Sablon 5A'", async () => {
    const result = await parser.transform("Pl. du Grand Sablon 5A");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Pl. du Grand Sablon");
    expect(result.fields.streetNumber).toBe("5A");
  });

  it("splits 'Calle Mayor, 12'", async () => {
    const result = await parser.transform("Calle Mayor, 12");
    expect(result.confidence).toBe(0.9);
    expect(result.fields.streetName).toBe("Calle Mayor");
    expect(result.fields.streetNumber).toBe("12");
  });

  it("keeps full string as streetName when no number", async () => {
    const result = await parser.transform("Place Royale");
    expect(result.confidence).toBe(0.5);
    expect(result.fields.streetName).toBe("Place Royale");
    expect(result.fields.streetNumber).toBeUndefined();
  });

  it("handles empty input", async () => {
    const result = await parser.transform("");
    expect(result.confidence).toBe(0);
  });
});
