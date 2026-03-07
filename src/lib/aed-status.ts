/**
 * AED Status State Machine
 *
 * Validates status transitions and provides helpers for status changes.
 * See docs/features/dea-lifecycle-workflows.md for the full lifecycle diagram.
 *
 * For status labels, colors, and filter options, see `./aed-status-config.ts`.
 */

import type { AedStatus } from "./aed-status-config";

const VALID_TRANSITIONS: Record<AedStatus, AedStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "PUBLISHED"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["INACTIVE", "PENDING_REVIEW", "REJECTED"],
  INACTIVE: ["PENDING_REVIEW"],
  REJECTED: ["DRAFT"],
};

/**
 * Check if a status transition is valid according to the state machine.
 * Returns true for valid transitions, false otherwise.
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from as AedStatus];
  if (!allowed) return false;
  return allowed.includes(to as AedStatus);
}

/**
 * Get the list of valid next statuses from a given status.
 */
export function getValidNextStatuses(from: string): AedStatus[] {
  return VALID_TRANSITIONS[from as AedStatus] || [];
}

/**
 * Validate a status transition and throw a descriptive error if invalid.
 */
export function validateStatusTransition(from: string, to: string): void {
  if (from === to) return; // No-op transitions are always valid
  if (!isValidStatusTransition(from, to)) {
    const allowed = getValidNextStatuses(from);
    throw new Error(
      `Transición de estado inválida: ${from} → ${to}. ` +
        `Transiciones permitidas desde ${from}: ${allowed.length > 0 ? allowed.join(", ") : "ninguna"}`
    );
  }
}
