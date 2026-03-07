/**
 * Tests for AED Status State Machine
 *
 * Validates that status transitions follow the defined lifecycle:
 *   DRAFT → PENDING_REVIEW → PUBLISHED → INACTIVE
 *                          ↘ REJECTED → DRAFT (re-draft)
 *   PUBLISHED → PENDING_REVIEW (re-verification)
 *   DRAFT → PUBLISHED (admin direct publish)
 *
 * These tests protect against:
 * - Accidentally allowing invalid transitions
 * - Breaking the verification flow
 * - Removing valid transitions needed by the app
 */

import { describe, it, expect } from "vitest";
import {
  isValidStatusTransition,
  getValidNextStatuses,
  validateStatusTransition,
} from "@/lib/aed-status";

// ── Valid transitions (happy paths) ────────────────────────────────

describe("isValidStatusTransition", () => {
  describe("valid transitions", () => {
    const validCases: [string, string][] = [
      // Normal verification flow
      ["DRAFT", "PENDING_REVIEW"],
      ["PENDING_REVIEW", "PUBLISHED"],
      ["PENDING_REVIEW", "REJECTED"],

      // Admin direct publish from draft
      ["DRAFT", "PUBLISHED"],

      // Deactivation
      ["PUBLISHED", "INACTIVE"],

      // Re-verification (published → review again)
      ["PUBLISHED", "PENDING_REVIEW"],

      // Rejection from published
      ["PUBLISHED", "REJECTED"],

      // Reactivation from inactive (goes back to review)
      ["INACTIVE", "PENDING_REVIEW"],

      // Re-draft from rejected
      ["REJECTED", "DRAFT"],
    ];

    it.each(validCases)("%s → %s should be valid", (from, to) => {
      expect(isValidStatusTransition(from, to)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    const invalidCases: [string, string][] = [
      // Cannot skip review backwards
      ["PUBLISHED", "DRAFT"],
      ["INACTIVE", "PUBLISHED"],
      ["INACTIVE", "DRAFT"],

      // Cannot go from rejected to published directly
      ["REJECTED", "PUBLISHED"],
      ["REJECTED", "PENDING_REVIEW"],
      ["REJECTED", "INACTIVE"],

      // Cannot go from draft directly to inactive/rejected
      ["DRAFT", "INACTIVE"],
      ["DRAFT", "REJECTED"],

      // Cannot go from pending_review to inactive/draft
      ["PENDING_REVIEW", "INACTIVE"],
      ["PENDING_REVIEW", "DRAFT"],
    ];

    it.each(invalidCases)("%s → %s should be invalid", (from, to) => {
      expect(isValidStatusTransition(from, to)).toBe(false);
    });
  });

  it("should return false for unknown source status", () => {
    expect(isValidStatusTransition("NONEXISTENT", "PUBLISHED")).toBe(false);
  });

  it("should return false for unknown target status", () => {
    expect(isValidStatusTransition("DRAFT", "NONEXISTENT")).toBe(false);
  });
});

// ── getValidNextStatuses ────────────────────────────────────────────

describe("getValidNextStatuses", () => {
  it("DRAFT can go to PENDING_REVIEW or PUBLISHED", () => {
    expect(getValidNextStatuses("DRAFT")).toEqual(
      expect.arrayContaining(["PENDING_REVIEW", "PUBLISHED"])
    );
  });

  it("PENDING_REVIEW can go to PUBLISHED or REJECTED", () => {
    expect(getValidNextStatuses("PENDING_REVIEW")).toEqual(
      expect.arrayContaining(["PUBLISHED", "REJECTED"])
    );
  });

  it("PUBLISHED can go to INACTIVE, PENDING_REVIEW, or REJECTED", () => {
    const next = getValidNextStatuses("PUBLISHED");
    expect(next).toEqual(expect.arrayContaining(["INACTIVE", "PENDING_REVIEW", "REJECTED"]));
  });

  it("INACTIVE can only go to PENDING_REVIEW", () => {
    expect(getValidNextStatuses("INACTIVE")).toEqual(["PENDING_REVIEW"]);
  });

  it("REJECTED can only go to DRAFT", () => {
    expect(getValidNextStatuses("REJECTED")).toEqual(["DRAFT"]);
  });

  it("should return empty array for unknown status", () => {
    expect(getValidNextStatuses("NONEXISTENT")).toEqual([]);
  });
});

// ── validateStatusTransition ────────────────────────────────────────

describe("validateStatusTransition", () => {
  it("should not throw for valid transitions", () => {
    expect(() => validateStatusTransition("DRAFT", "PENDING_REVIEW")).not.toThrow();
    expect(() => validateStatusTransition("PENDING_REVIEW", "PUBLISHED")).not.toThrow();
  });

  it("should allow no-op transitions (same status)", () => {
    expect(() => validateStatusTransition("DRAFT", "DRAFT")).not.toThrow();
    expect(() => validateStatusTransition("PUBLISHED", "PUBLISHED")).not.toThrow();
    expect(() => validateStatusTransition("INACTIVE", "INACTIVE")).not.toThrow();
  });

  it("should throw for invalid transitions with descriptive message", () => {
    expect(() => validateStatusTransition("REJECTED", "PUBLISHED")).toThrow(
      /Transición de estado inválida: REJECTED → PUBLISHED/
    );
  });

  it("error message should list allowed transitions", () => {
    expect(() => validateStatusTransition("REJECTED", "PUBLISHED")).toThrow(
      /Transiciones permitidas desde REJECTED: DRAFT/
    );
  });

  it("error message for terminal-like state shows allowed transitions", () => {
    // INACTIVE only allows PENDING_REVIEW
    expect(() => validateStatusTransition("INACTIVE", "PUBLISHED")).toThrow(
      /Transiciones permitidas desde INACTIVE: PENDING_REVIEW/
    );
  });
});
