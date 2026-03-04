/**
 * API Route: /api/aeds/bulk-publication
 *
 * Endpoint to update publication_mode for multiple AEDs at once
 * Useful for mass imports and bulk operations
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { PublicationMode } from "@/generated/client/client";

interface BulkUpdatePublicationRequest {
  aed_ids: string[];
  publication_mode: PublicationMode;
  reason?: string;
  notes?: string;
}

/**
 * POST /api/aeds/bulk-publication
 * Update publication_mode for multiple AEDs
 *
 * Body:
 * - aed_ids: array of AED IDs to update
 * - publication_mode: "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL"
 * - reason: optional string explaining the change
 * - notes: optional additional notes
 *
 * Response:
 * - Number of AEDs updated
 * - List of successful and failed updates
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const body: BulkUpdatePublicationRequest = await request.json();

    // Validate request
    if (!body.aed_ids || !Array.isArray(body.aed_ids) || body.aed_ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          message: "aed_ids must be a non-empty array of AED IDs",
        },
        { status: 400 }
      );
    }

    // Validate publication_mode
    const validModes: PublicationMode[] = ["NONE", "LOCATION_ONLY", "BASIC_INFO", "FULL"];
    if (!body.publication_mode || !validModes.includes(body.publication_mode)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid publication_mode",
          message: `publication_mode must be one of: ${validModes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Limit to 500 AEDs per request to avoid performance issues
    if (body.aed_ids.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many AEDs",
          message: "Maximum 500 AEDs per bulk update request",
        },
        { status: 400 }
      );
    }

    // Get current AEDs to track changes
    const currentAeds = await prisma.aed.findMany({
      where: {
        id: { in: body.aed_ids },
      },
      select: {
        id: true,
        publication_mode: true,
      },
    });

    if (currentAeds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No AEDs found",
          message: "None of the provided AED IDs were found",
        },
        { status: 404 }
      );
    }

    // Filter AEDs that actually need updating (mode is different)
    const aedsToUpdate = currentAeds.filter(
      (aed) => aed.publication_mode !== body.publication_mode
    );

    if (aedsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All AEDs already have the requested publication mode",
        stats: {
          total_requested: body.aed_ids.length,
          found: currentAeds.length,
          updated: 0,
          skipped: currentAeds.length,
          not_found: body.aed_ids.length - currentAeds.length,
        },
      });
    }

    // Update all AEDs and create history entries in a transaction
    const now = new Date();
    const results = await prisma.$transaction(async (tx) => {
      // Update all AEDs
      const updateResult = await tx.aed.updateMany({
        where: {
          id: { in: aedsToUpdate.map((a) => a.id) },
        },
        data: {
          publication_mode: body.publication_mode,
          publication_approved_at: now,
          publication_approved_by: user.userId,
          updated_at: now,
          updated_by: user.userId,
        },
      });

      // Create publication history entries for each AED
      const historyEntries = aedsToUpdate.map((aed) => ({
        aed_id: aed.id,
        previous_mode: aed.publication_mode,
        new_mode: body.publication_mode,
        changed_by: user.userId,
        changed_by_role: user.role || "USER",
        change_reason: body.reason || `Bulk update to ${body.publication_mode}`,
        requires_approval: false,
        approved_by: user.userId,
        approved_at: now,
        approval_notes: body.notes || null,
      }));

      await tx.aedPublicationHistory.createMany({
        data: historyEntries,
      });

      return {
        updated_count: updateResult.count,
        history_entries_created: historyEntries.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated publication mode for ${results.updated_count} AEDs`,
      stats: {
        total_requested: body.aed_ids.length,
        found: currentAeds.length,
        updated: results.updated_count,
        skipped: currentAeds.length - aedsToUpdate.length,
        not_found: body.aed_ids.length - currentAeds.length,
      },
      data: {
        publication_mode: body.publication_mode,
        updated_aed_ids: aedsToUpdate.map((a) => a.id),
      },
    });
  } catch (error) {
    console.error("Error in bulk publication update:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update publication mode",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
