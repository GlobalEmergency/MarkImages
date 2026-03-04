/**
 * System User Constants
 *
 * Defines the special UUID for system operations (automated processes,
 * validations, cron jobs, etc.) where no real user is involved.
 */

/**
 * Special UUID for system operations
 * This UUID is reserved for automated processes and operations
 * that don't have a specific user context.
 */
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Check if a user ID represents the system user
 */
export function isSystemUser(userId: string): boolean {
  return userId === SYSTEM_USER_ID;
}
