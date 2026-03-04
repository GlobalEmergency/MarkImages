/**
 * System Constants
 *
 * Constants used across the application for system-level operations
 */

/**
 * System User UUID
 *
 * Special UUID used for automated operations where no specific user is performing the action.
 * This includes:
 * - Automated synchronizations (cron jobs)
 * - Batch imports
 * - System-initiated data updates
 * - Automated field changes
 *
 * Usage:
 * - `created_by` field when system creates records
 * - `updated_by` field when system updates records
 * - `changed_by` field in aed_field_changes for system operations
 *
 * Benefits:
 * - Enables complete audit trail in `aed_field_changes`
 * - Easy to identify system operations in queries
 * - No need to create a "system" user in the database
 * - Industry-standard approach for system operations
 */
export const SYSTEM_USER_UUID = "00000000-0000-0000-0000-000000000000";
