/**
 * Audit Trail Helpers
 *
 * Shared utilities for recording status changes, field changes,
 * and manipulating internal_notes across the application.
 *
 * These helpers centralise the audit-trail logic that was previously
 * duplicated in verify/duplicates, verify/complete, admin PATCH, etc.
 */

import type { AedStatus, ChangeSource } from "@/generated/client/enums";

/**
 * Transaction-compatible Prisma client interface.
 * Accepts both the full `prisma` client and the `tx` client inside `prisma.$transaction()`.
 *
 * We define only the methods we need instead of importing the full PrismaClient type,
 * because the transaction client is an Omit<> that doesn't satisfy PrismaClient.
 */
interface AuditTxClient {
  aedStatusChange: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  aedFieldChange: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

// ── Status Change ────────────────────────────────────────────────────

interface RecordStatusChangeParams {
  aedId: string;
  previousStatus: string;
  newStatus: string;
  modifiedBy: string;
  reason: string;
  notes?: string;
}

/**
 * Record an AED status change in the audit trail.
 * Accepts either a Prisma client or a transaction client.
 */
export async function recordStatusChange(
  tx: AuditTxClient,
  params: RecordStatusChangeParams
): Promise<void> {
  await tx.aedStatusChange.create({
    data: {
      aed_id: params.aedId,
      previous_status: params.previousStatus as AedStatus,
      new_status: params.newStatus as AedStatus,
      reason: params.reason,
      modified_by: params.modifiedBy,
      notes: params.notes,
    },
  });
}

// ── Field Change ─────────────────────────────────────────────────────

interface RecordFieldChangeParams {
  aedId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changeSource?: ChangeSource;
}

/**
 * Record a single field change in the audit trail.
 */
export async function recordFieldChange(
  tx: AuditTxClient,
  params: RecordFieldChangeParams
): Promise<void> {
  await tx.aedFieldChange.create({
    data: {
      aed_id: params.aedId,
      field_name: params.fieldName,
      old_value: params.oldValue,
      new_value: params.newValue,
      changed_by: params.changedBy,
      change_source: params.changeSource ?? ("WEB_UI" as ChangeSource),
    },
  });
}

// ── Internal Notes ───────────────────────────────────────────────────

/**
 * Build a new internal_notes array by appending a note to existing notes.
 * Safely handles null/non-array values.
 *
 * Returns a plain object array compatible with Prisma's JSON fields.
 * Usage: `prisma.aed.update({ data: { internal_notes: appendInternalNote(...) } })`
 */
export function appendInternalNote(
  currentNotes: unknown,
  text: string,
  type: string,
  author: string
): Array<Record<string, string>> {
  const notes: Array<Record<string, string>> = Array.isArray(currentNotes)
    ? (currentNotes as Array<Record<string, string>>)
    : [];

  return [
    ...notes,
    {
      text,
      date: new Date().toISOString(),
      type,
      author,
    },
  ];
}
