import { describe, it, expect } from "vitest";
import { isValidStatusTransition, validateStatusTransition } from "../../../src/lib/aed-status";

describe("AedStatus State Machine", () => {
  describe("isValidStatusTransition", () => {
    // A. Transiciones Válidas (Valid Transitions)
    it("shouldReturnTrueWhenTransitionIsDraftToPendingReview", () => {
      // Arrange
      const from = "DRAFT";
      const to = "PENDING_REVIEW";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(true);
    });

    it("shouldReturnTrueWhenTransitionIsPendingReviewToPublished", () => {
      // Arrange
      const from = "PENDING_REVIEW";
      const to = "PUBLISHED";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(true);
    });

    it("shouldReturnTrueWhenTransitionIsPublishedToInactive", () => {
      // Arrange
      const from = "PUBLISHED";
      const to = "INACTIVE";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(true);
    });

    it("shouldReturnTrueWhenTransitionIsPublishedToPendingReview", () => {
      // Arrange
      const from = "PUBLISHED";
      const to = "PENDING_REVIEW";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(true);
    });

    it("shouldReturnTrueWhenTransitionIsRejectedToDraft", () => {
      // Arrange
      const from = "REJECTED";
      const to = "DRAFT";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(true);
    });

    // B. Transiciones Inválidas (Invalid Transitions)
    it("shouldReturnFalseWhenTransitionIsRejectedToPublished", () => {
      // Arrange
      const from = "REJECTED";
      const to = "PUBLISHED";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(false);
    });

    it("shouldReturnFalseWhenTransitionIsInactiveToDraft", () => {
      // Arrange
      const from = "INACTIVE";
      const to = "DRAFT";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(false);
    });

    // C. Casos Extremos (Edge Cases)
    it("shouldReturnFalseWhenStatusIsUnknown", () => {
      // Arrange
      const from = "UNKNOWN";
      const to = "DRAFT";

      // Act
      const result = isValidStatusTransition(from, to);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("validateStatusTransition", () => {
    // B. Transiciones Inválidas (Cont.)
    it("shouldThrowErrorWhenUsingValidateStatusTransitionOnInvalidState", () => {
      // Arrange
      const from = "REJECTED";
      const to = "PUBLISHED";

      // Act & Assert
      expect(() => validateStatusTransition(from, to)).toThrowError(
        /Transición de estado inválida: REJECTED → PUBLISHED/
      );
    });

    // C. Casos Extremos (Cont.)
    it("shouldReturnTrueWhenFromAndToStatesAreTheSame", () => {
      // Arrange
      const from = "PUBLISHED";
      const to = "PUBLISHED";

      // Act & Assert
      // should not throw, acts as a no-op
      expect(() => validateStatusTransition(from, to)).not.toThrow();
    });
  });
});
