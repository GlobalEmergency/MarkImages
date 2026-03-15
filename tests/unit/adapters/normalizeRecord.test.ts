import { describe, it, expect } from "vitest";
import { normalizeRecord } from "@/import/infrastructure/adapters/normalizeRecord";

describe("normalizeRecord", () => {
  it("returns a copy without mutating the original", () => {
    const original = { name: "Test" };
    const result = normalizeRecord(original);
    expect(result).not.toBe(original);
    expect(result.name).toBe("Test");
    expect(original).toEqual({ name: "Test" });
  });

  // ----------------------------------------------------------
  // Nested object flattening
  // ----------------------------------------------------------
  describe("nested object flattening", () => {
    it("flattens geo_point_2d: { lon, lat }", () => {
      const result = normalizeRecord({
        geo_point_2d: { lon: 7.6, lat: 47.5 },
      });
      expect(result["geo_point_2d.lon"]).toBe(7.6);
      expect(result["geo_point_2d.lat"]).toBe(47.5);
    });

    it("flattens arbitrary nested objects", () => {
      const result = normalizeRecord({
        address: { street: "Mayor", number: "10" },
      });
      expect(result["address.street"]).toBe("Mayor");
      expect(result["address.number"]).toBe("10");
    });

    it("skips null/undefined nested values", () => {
      const result = normalizeRecord({
        point: { x: 1, y: null, z: undefined },
      });
      expect(result["point.x"]).toBe(1);
      expect(result["point.y"]).toBeUndefined();
      expect(result["point.z"]).toBeUndefined();
    });

    it("skips deeply nested objects (only one level deep)", () => {
      const result = normalizeRecord({
        deep: { level1: { level2: "value" } },
      });
      // The nested object itself is skipped (typeof === 'object')
      expect(result["deep.level1"]).toBeUndefined();
    });

    it("skips arrays (not flattened)", () => {
      const result = normalizeRecord({
        tags: ["a", "b"],
      });
      // Arrays are not objects to flatten, kept as-is
      expect(result.tags).toEqual(["a", "b"]);
    });
  });

  // ----------------------------------------------------------
  // WKT POINT parsing
  // ----------------------------------------------------------
  describe("WKT POINT parsing", () => {
    it("parses POINT(-4.419 36.717)", () => {
      const result = normalizeRecord({
        wkb_geometry: "POINT(-4.419 36.717)",
      });
      expect(result["wkb_geometry.longitude"]).toBeCloseTo(-4.419);
      expect(result["wkb_geometry.latitude"]).toBeCloseTo(36.717);
    });

    it("parses POINT with extra spaces", () => {
      const result = normalizeRecord({
        geom: "POINT(  2.154  41.389  )",
      });
      expect(result["geom.longitude"]).toBeCloseTo(2.154);
      expect(result["geom.latitude"]).toBeCloseTo(41.389);
    });

    it("is case-insensitive", () => {
      const result = normalizeRecord({
        geo: "point(7.6 47.5)",
      });
      expect(result["geo.longitude"]).toBeCloseTo(7.6);
      expect(result["geo.latitude"]).toBeCloseTo(47.5);
    });

    it("does not parse non-POINT WKT", () => {
      const result = normalizeRecord({
        geom: "LINESTRING(0 0, 1 1)",
      });
      expect(result["geom.longitude"]).toBeUndefined();
      expect(result["geom.latitude"]).toBeUndefined();
    });

    it("does not parse random strings as WKT", () => {
      const result = normalizeRecord({
        name: "Hospital Central",
      });
      expect(result["name.longitude"]).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // Passthrough
  // ----------------------------------------------------------
  describe("passthrough", () => {
    it("preserves scalar fields unchanged", () => {
      const result = normalizeRecord({
        name: "Test",
        count: 42,
        active: true,
      });
      expect(result.name).toBe("Test");
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
    });

    it("preserves null/undefined fields", () => {
      const result = normalizeRecord({
        name: null,
        code: undefined,
      });
      expect(result.name).toBeNull();
      expect(result.code).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // Corner cases
  // ----------------------------------------------------------
  describe("corner cases", () => {
    it("handles empty object", () => {
      const result = normalizeRecord({});
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("handles WKT POINT with negative coordinates", () => {
      const result = normalizeRecord({
        geom: "POINT(-73.9857 40.7484)",
      });
      expect(result["geom.longitude"]).toBeCloseTo(-73.9857);
      expect(result["geom.latitude"]).toBeCloseTo(40.7484);
    });

    it("handles WKT POINT with high precision decimals", () => {
      const result = normalizeRecord({
        geom: "POINT(-3.7037901234 40.4167754321)",
      });
      expect(result["geom.longitude"]).toBeCloseTo(-3.7037901234, 8);
      expect(result["geom.latitude"]).toBeCloseTo(40.4167754321, 8);
    });

    it("preserves original nested object alongside flattened keys", () => {
      // The spread `{ ...record }` copies the nested object, and flattened keys are added
      const result = normalizeRecord({
        geo: { lat: 47.5, lon: 7.6 },
      });
      // Flattened keys added
      expect(result["geo.lat"]).toBe(47.5);
      expect(result["geo.lon"]).toBe(7.6);
      // Original nested object is preserved (spread copied it before continue)
      expect(result.geo).toEqual({ lat: 47.5, lon: 7.6 });
    });

    it("handles nested object with boolean/number sub-values", () => {
      const result = normalizeRecord({
        meta: { active: true, count: 42, label: "test" },
      });
      expect(result["meta.active"]).toBe(true);
      expect(result["meta.count"]).toBe(42);
      expect(result["meta.label"]).toBe("test");
    });

    it("handles both nested object AND WKT string in same record", () => {
      const result = normalizeRecord({
        geo_point_2d: { lon: 2.154, lat: 41.389 },
        wkb_geometry: "POINT(-4.419 36.717)",
        name: "Mixed",
      });
      expect(result["geo_point_2d.lon"]).toBe(2.154);
      expect(result["geo_point_2d.lat"]).toBe(41.389);
      expect(result["wkb_geometry.longitude"]).toBeCloseTo(-4.419);
      expect(result["wkb_geometry.latitude"]).toBeCloseTo(36.717);
      expect(result.name).toBe("Mixed");
    });

    it("handles empty nested object (preserved via spread, no flattened keys)", () => {
      const result = normalizeRecord({ empty: {} });
      // Spread copies the empty object, no sub-keys to flatten
      expect(result.empty).toEqual({});
      // No dot-notation keys generated
      expect(Object.keys(result).filter((k) => k.startsWith("empty."))).toHaveLength(0);
    });

    it("handles WKT POINT(0 0) — valid at null island", () => {
      const result = normalizeRecord({
        geom: "POINT(0 0)",
      });
      expect(result["geom.longitude"]).toBe(0);
      expect(result["geom.latitude"]).toBe(0);
    });

    it("does not parse POINT without parentheses", () => {
      const result = normalizeRecord({
        geom: "POINT 7.6 47.5",
      });
      expect(result["geom.longitude"]).toBeUndefined();
    });

    it("handles string that looks like POINT but has extra content", () => {
      const result = normalizeRecord({
        geom: "POINT(7.6 47.5) extra stuff",
      });
      // Regex requires end-of-string anchor ($) → no match
      expect(result["geom.longitude"]).toBeUndefined();
    });
  });
});
