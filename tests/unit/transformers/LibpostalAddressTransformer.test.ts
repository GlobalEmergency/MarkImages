import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LibpostalAddressTransformer } from "@/import/infrastructure/transformers/LibpostalAddressTransformer";

describe("LibpostalAddressTransformer", () => {
  let transformer: LibpostalAddressTransformer;

  beforeEach(() => {
    // Instancia fresca en cada test para resetear circuit breaker
    transformer = new LibpostalAddressTransformer();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has correct name", () => {
    expect(transformer.name).toBe("libpostal-address");
  });

  it("parses a simple address with street type", async () => {
    const mockResponse = [
      { label: "road", value: "calle gran vía" },
      { label: "house_number", value: "42" },
      { label: "postcode", value: "28013" },
      { label: "city", value: "madrid" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Calle Gran Vía 42, 28013 Madrid");

    expect(result.confidence).toBe(0.85);
    expect(result.fields.streetType).toBe("Calle");
    expect(result.fields.streetName).toBe("Gran Vía");
    expect(result.fields.streetNumber).toBe("42");
    expect(result.fields.postalCode).toBe("28013");
    expect(result.fields.city).toBe("Madrid");
  });

  it("parses address without street type", async () => {
    const mockResponse = [
      { label: "road", value: "ronda de toledo" },
      { label: "house_number", value: "5" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Ronda de Toledo 5");

    expect(result.confidence).toBe(0.85);
    expect(result.fields.streetType).toBe("Ronda");
    expect(result.fields.streetName).toBe("De Toledo");
  });

  it("handles address with abbreviated street type", async () => {
    const mockResponse = [
      { label: "road", value: "avda. de la constitución" },
      { label: "house_number", value: "10" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Avda. de la Constitución 10");

    expect(result.fields.streetType).toBe("Avda");
    expect(result.fields.streetName).toBe("De La Constitución");
  });

  it("returns confidence 0 when service is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await transformer.transform("Calle Mayor 1, Madrid");

    expect(result.confidence).toBe(0);
    expect(result.fields).toEqual({});
  });

  it("returns confidence 0 when response is not OK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as globalThis.Response);

    const result = await transformer.transform("Calle Mayor 1, Madrid");

    expect(result.confidence).toBe(0);
  });

  it("returns confidence 0 when response is empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as globalThis.Response);

    const result = await transformer.transform("???");

    expect(result.confidence).toBe(0);
    expect(result.fields).toEqual({});
  });

  it("returns low confidence when no street name found", async () => {
    const mockResponse = [
      { label: "city", value: "madrid" },
      { label: "state", value: "comunidad de madrid" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Madrid");

    expect(result.confidence).toBe(0.3);
    expect(result.fields.city).toBe("Madrid");
    expect(result.fields.district).toBe("Comunidad De Madrid");
  });

  it("handles suburb/neighbourhood fields", async () => {
    const mockResponse = [
      { label: "road", value: "calle serrano" },
      { label: "suburb", value: "salamanca" },
      { label: "city", value: "madrid" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Calle Serrano, Salamanca, Madrid");

    expect(result.fields.streetType).toBe("Calle");
    expect(result.fields.streetName).toBe("Serrano");
    expect(result.fields.neighborhood).toBe("Salamanca");
    expect(result.fields.city).toBe("Madrid");
  });

  it("handles road without recognized street type", async () => {
    const mockResponse = [
      { label: "road", value: "almirante cristóbal mello" },
      { label: "house_number", value: "4" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Almirante Cristóbal Mello 4");

    expect(result.fields.streetType).toBeNull();
    expect(result.fields.streetName).toBe("Almirante Cristóbal Mello");
    expect(result.fields.streetNumber).toBe("4");
  });

  // === Basque address handling ===

  it("parses Basque street type (Kalea)", async () => {
    const mockResponse = [
      { label: "road", value: "txurrua kalea" },
      { label: "house_number", value: "1" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Txurrua Kalea 1");

    expect(result.confidence).toBe(0.85);
    expect(result.fields.streetType).toBe("Kalea");
    expect(result.fields.streetName).toBe("Txurrua");
  });

  it("parses Basque street type (Etorbidea)", async () => {
    const mockResponse = [
      { label: "road", value: "abandoibarra etorbidea" },
      { label: "house_number", value: "2" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Abandoibarra Etorbidea 2");

    expect(result.fields.streetType).toBe("Etorbidea");
    expect(result.fields.streetName).toBe("Abandoibarra");
  });

  it("handles 'house' label — extracts number from Basque address", async () => {
    // libpostal classifies some Basque addresses as "house" instead of road+number
    const mockResponse = [{ label: "house", value: "txurrua 1 plentzia" }];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Txurrua 1");

    expect(result.fields.streetName).toBe("Txurrua");
    expect(result.fields.streetNumber).toBe("1");
  });

  it("handles 'house' label — single word without number", async () => {
    const mockResponse = [{ label: "house", value: "hondartza orio" }];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Hondartza");

    // "hondartza orio" has no number, so streetName = full value, streetNumber absent
    expect(result.fields.streetName).toBe("Hondartza Orio");
    expect(result.fields.streetNumber).toBeUndefined();
  });

  it("parses Catalan street type (Carrer)", async () => {
    const mockResponse = [
      { label: "road", value: "carrer de balmes" },
      { label: "house_number", value: "25" },
      { label: "city", value: "barcelona" },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as globalThis.Response);

    const result = await transformer.transform("Carrer de Balmes 25, Barcelona");

    expect(result.fields.streetType).toBe("Carrer");
    expect(result.fields.streetName).toBe("De Balmes");
    expect(result.fields.city).toBe("Barcelona");
  });
});
