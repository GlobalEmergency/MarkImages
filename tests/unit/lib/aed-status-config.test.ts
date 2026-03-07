/**
 * Tests for AED Status Configuration — the single source of truth for
 * status labels, colors, filter options, and visibility rules.
 *
 * These tests protect against regressions when:
 * - Adding/removing statuses
 * - Changing visibility rules (visibleToAll)
 * - Modifying filter option sets
 * - Renaming labels (which would break UI consistency)
 */

import { describe, it, expect } from "vitest";
import {
  AED_STATUS_CONFIG,
  AED_STATUS_FILTER_OPTIONS_ALL,
  AED_STATUS_FILTER_OPTIONS_USER,
  AED_STATUS_OPTIONS,
  getStatusLabel,
  getStatusColor,
  getStatusFilterOptions,
  type AedStatus,
} from "@/lib/aed-status-config";

// ── All known statuses ─────────────────────────────────────────────
const ALL_STATUSES: AedStatus[] = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "INACTIVE", "REJECTED"];

describe("AED_STATUS_CONFIG", () => {
  it("should contain exactly the 5 known statuses", () => {
    const configKeys = Object.keys(AED_STATUS_CONFIG);
    expect(configKeys).toHaveLength(5);
    for (const status of ALL_STATUSES) {
      expect(AED_STATUS_CONFIG).toHaveProperty(status);
    }
  });

  it("every status should have all required fields", () => {
    for (const [status, info] of Object.entries(AED_STATUS_CONFIG)) {
      expect(info.label, `${status}.label`).toBeTruthy();
      expect(info.pluralLabel, `${status}.pluralLabel`).toBeTruthy();
      expect(info.color, `${status}.color`).toBeTruthy();
      expect(info.dotColor, `${status}.dotColor`).toBeTruthy();
      expect(typeof info.visibleToAll, `${status}.visibleToAll`).toBe("boolean");
    }
  });

  it("label and pluralLabel should be different for each status", () => {
    for (const [status, info] of Object.entries(AED_STATUS_CONFIG)) {
      expect(info.label, `${status}: label !== pluralLabel`).not.toBe(info.pluralLabel);
    }
  });

  it("color should be valid Tailwind badge classes (bg-* text-*)", () => {
    for (const [status, info] of Object.entries(AED_STATUS_CONFIG)) {
      expect(info.color, `${status}.color`).toMatch(/^bg-\S+ text-\S+$/);
    }
  });

  it("dotColor should be a single Tailwind bg class", () => {
    for (const [status, info] of Object.entries(AED_STATUS_CONFIG)) {
      expect(info.dotColor, `${status}.dotColor`).toMatch(/^bg-\S+$/);
    }
  });

  it("all statuses should be visible to all users (org autonomy)", () => {
    for (const [status, info] of Object.entries(AED_STATUS_CONFIG)) {
      expect(info.visibleToAll, `${status} should be visibleToAll`).toBe(true);
    }
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

describe("getStatusLabel", () => {
  it.each([
    ["DRAFT", "Borrador"],
    ["PENDING_REVIEW", "Pendiente de revisión"],
    ["PUBLISHED", "Publicado"],
    ["INACTIVE", "Inactivo"],
    ["REJECTED", "Rechazado"],
  ])("should return %s → %s", (status, expected) => {
    expect(getStatusLabel(status)).toBe(expected);
  });

  it("should return the raw string for unknown statuses", () => {
    expect(getStatusLabel("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
    expect(getStatusLabel("")).toBe("");
  });
});

describe("getStatusColor", () => {
  it("should return Tailwind classes for known statuses", () => {
    for (const status of ALL_STATUSES) {
      const color = getStatusColor(status);
      expect(color).toMatch(/^bg-\S+ text-\S+$/);
    }
  });

  it("should return default gray for unknown statuses", () => {
    expect(getStatusColor("UNKNOWN")).toBe("bg-gray-100 text-gray-800");
  });

  it("PUBLISHED should use green", () => {
    expect(getStatusColor("PUBLISHED")).toContain("green");
  });

  it("REJECTED should use red", () => {
    expect(getStatusColor("REJECTED")).toContain("red");
  });
});

// ── Filter option sets ──────────────────────────────────────────────

describe("AED_STATUS_FILTER_OPTIONS_ALL", () => {
  it("should start with 'Todos los estados' option", () => {
    expect(AED_STATUS_FILTER_OPTIONS_ALL[0]).toEqual({
      value: "all",
      label: "Todos los estados",
    });
  });

  it("should contain all 5 statuses plus the 'all' option", () => {
    expect(AED_STATUS_FILTER_OPTIONS_ALL).toHaveLength(6);
  });

  it("should use pluralLabel for each status option", () => {
    const statusOptions = AED_STATUS_FILTER_OPTIONS_ALL.slice(1);
    for (const opt of statusOptions) {
      const config = AED_STATUS_CONFIG[opt.value as AedStatus];
      expect(config, `Config for ${opt.value}`).toBeDefined();
      expect(opt.label).toBe(config.pluralLabel);
    }
  });
});

describe("AED_STATUS_FILTER_OPTIONS_USER", () => {
  it("should start with 'Todos los estados' option", () => {
    expect(AED_STATUS_FILTER_OPTIONS_USER[0]).toEqual({
      value: "all",
      label: "Todos los estados",
    });
  });

  it("should only include statuses where visibleToAll is true", () => {
    const statusOptions = AED_STATUS_FILTER_OPTIONS_USER.slice(1);
    for (const opt of statusOptions) {
      const config = AED_STATUS_CONFIG[opt.value as AedStatus];
      expect(config.visibleToAll, `${opt.value} should be visibleToAll`).toBe(true);
    }
  });

  it("should not include any status where visibleToAll is false", () => {
    const hiddenStatuses = Object.entries(AED_STATUS_CONFIG)
      .filter(([, info]) => !info.visibleToAll)
      .map(([status]) => status);

    const userValues = AED_STATUS_FILTER_OPTIONS_USER.map((o) => o.value);
    for (const hidden of hiddenStatuses) {
      expect(userValues).not.toContain(hidden);
    }
  });
});

describe("AED_STATUS_OPTIONS", () => {
  it("should NOT include an 'all' option", () => {
    const values = AED_STATUS_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("all");
  });

  it("should contain exactly 5 statuses", () => {
    expect(AED_STATUS_OPTIONS).toHaveLength(5);
  });

  it("should use singular label (not plural)", () => {
    for (const opt of AED_STATUS_OPTIONS) {
      const config = AED_STATUS_CONFIG[opt.value as AedStatus];
      expect(opt.label).toBe(config.label);
    }
  });
});

describe("getStatusFilterOptions", () => {
  it("should return ALL options for admin", () => {
    expect(getStatusFilterOptions(true)).toBe(AED_STATUS_FILTER_OPTIONS_ALL);
  });

  it("should return USER options for non-admin", () => {
    expect(getStatusFilterOptions(false)).toBe(AED_STATUS_FILTER_OPTIONS_USER);
  });
});
