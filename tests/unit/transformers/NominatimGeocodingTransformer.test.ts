import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NominatimGeocodingTransformer } from "@/import/infrastructure/transformers/NominatimGeocodingTransformer";

/**
 * Helper: crea un mock Response de Nominatim con los datos indicados.
 */
function mockNominatimResponse(results: unknown[]) {
  return {
    ok: true,
    json: async () => results,
  } as globalThis.Response;
}

/** Contexto típico de CyL con campos ya mapeados */
const CYL_CONTEXT = {
  streetType: "CALLE",
  streetName: "LAGAR",
  streetNumber: "0",
  city: "SAELICES DE MAYORGA",
  district: "VALLADOLID",
  postalCode: null,
};

/** Respuesta típica de Nominatim para una dirección española */
const NOMINATIM_RESULT = {
  lat: "42.0745",
  lon: "-5.2903",
  display_name: "Calle Lagar, Saelices de Mayorga, Valladolid, Castilla y León, España",
  address: {
    road: "Calle Lagar",
    postcode: "47812",
    village: "Saelices de Mayorga",
    state: "Castilla y León",
    country: "España",
  },
};

describe("NominatimGeocodingTransformer", () => {
  let transformer: NominatimGeocodingTransformer;

  beforeEach(() => {
    transformer = new NominatimGeocodingTransformer();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has correct name", () => {
    expect(transformer.name).toBe("nominatim-geocode");
  });

  it("geocodes address from context fields (structured query)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([NOMINATIM_RESULT]));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.fields.latitude).toBe("42.0745");
    expect(result.fields.longitude).toBe("-5.2903");
    expect(result.fields.postalCode).toBe("47812");

    // Verificar que la URL usa query estructurada
    const fetchCall = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(fetchCall).toContain("street=");
    expect(fetchCall).toContain("city=");
    expect(fetchCall).toContain("countrycodes=es");
  });

  it("falls back to free-form query when structured returns no results", async () => {
    // Primera llamada (structured): sin resultados
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([]));
    // Segunda llamada (free-form): con resultados
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([NOMINATIM_RESULT]));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.fields.latitude).toBe("42.0745");

    // Verificar que hubo 2 llamadas (structured + free-form)
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(secondCall).toContain("q=");
  });

  it("returns confidence 0 when service is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.confidence).toBe(0);
    expect(result.fields).toEqual({});
  });

  it("returns confidence 0 when no results found", async () => {
    // Structured: empty
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([]));
    // Free-form: empty
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([]));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.confidence).toBe(0);
    expect(result.fields).toEqual({});
  });

  it("filters out street number '0' (CyL uses 0 for missing)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([NOMINATIM_RESULT]));

    await transformer.transform("LAGAR", {
      ...CYL_CONTEXT,
      streetNumber: "0",
    });

    const fetchUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    // Should have "CALLE LAGAR" without "0"
    expect(fetchUrl).toContain("street=CALLE+LAGAR");
    expect(fetchUrl).not.toContain("street=CALLE+LAGAR+0");
  });

  it("circuit breaker prevents repeated calls after failure", async () => {
    // Primera llamada falla
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await transformer.transform("LAGAR", CYL_CONTEXT);

    // Segunda llamada debería ir directamente a confidence 0 sin HTTP
    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.confidence).toBe(0);
    // fetch solo fue llamado 1 vez (la primera)
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("extracts postalCode from Nominatim response", async () => {
    const resultWithPostcode = {
      ...NOMINATIM_RESULT,
      address: { ...NOMINATIM_RESULT.address, postcode: "47812" },
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([resultWithPostcode]));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    expect(result.fields.postalCode).toBe("47812");
  });

  it("does not override existing postalCode from context", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([NOMINATIM_RESULT]));

    const contextWithPostcode = { ...CYL_CONTEXT, postalCode: "47800" };
    const result = await transformer.transform("LAGAR", contextWithPostcode);

    // Should NOT override the existing postalCode
    expect(result.fields.postalCode).toBeUndefined();
    expect(result.fields.latitude).toBe("42.0745");
  });

  it("geocodes with raw value when no context available", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([NOMINATIM_RESULT]));

    const result = await transformer.transform("CALLE LAGAR, SAELICES DE MAYORGA, VALLADOLID");

    // Without context, structured query is skipped, goes to free-form
    expect(result.fields.latitude).toBe("42.0745");
  });

  it("returns confidence 0 for empty address", async () => {
    const result = await transformer.transform("", {});

    expect(result.confidence).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calculates higher confidence when road and city match", async () => {
    const resultWithMatches = {
      ...NOMINATIM_RESULT,
      address: {
        ...NOMINATIM_RESULT.address,
        road: "Calle Lagar",
        village: "Saelices de Mayorga",
      },
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockNominatimResponse([resultWithMatches]));

    const result = await transformer.transform("LAGAR", CYL_CONTEXT);

    // Base 0.5 + postcode 0.1 + road match 0.15 + city match 0.1 = 0.85
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
