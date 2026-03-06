/**
 * API Route: /api/aeds/[id]/publication
 *
 * Endpoint to manage publication_mode of individual AEDs
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { PublicationMode } from "@/generated/client/client";

interface UpdatePublicationRequest {
  publication_mode: PublicationMode;
  reason?: string;
  notes?: string;
}

/**
 * PATCH /api/aeds/[id]/publication
 * Update publication_mode of a single AED
 *
 * Body:
 * - publication_mode: "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL"
 * - reason: optional string explaining the change
 * - notes: optional additional notes
 *
 * Response:
 * - Updated AED with new publication_mode
 * - Publication history entry created
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);

    const { id } = await params;
    const body: UpdatePublicationRequest = await request.json();

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

    // Get current AED to check existing publication_mode
    const currentAed = await prisma.aed.findUnique({
      where: { id },
      select: {
        publication_mode: true,
        status: true,
      },
    });

    if (!currentAed) {
      return NextResponse.json(
        {
          success: false,
          error: "AED not found",
          message: `No AED found with ID: ${id}`,
        },
        { status: 404 }
      );
    }

    // Check if publication_mode is actually changing
    if (currentAed.publication_mode === body.publication_mode) {
      return NextResponse.json(
        {
          success: true,
          message: "Publication mode unchanged",
          data: currentAed,
        },
        { status: 200 }
      );
    }

    // Update AED and create history entry in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update AED publication_mode
      const updatedAed = await tx.aed.update({
        where: { id },
        data: {
          publication_mode: body.publication_mode,
          publication_approved_at: new Date(),
          publication_approved_by: user.userId,
          updated_at: new Date(),
          updated_by: user.userId,
        },
        include: {
          location: true,
          responsible: true,
          schedule: true,
          images: {
            where: { is_verified: true },
            orderBy: { order: "asc" },
          },
        },
      });

      // Create publication history entry
      await tx.aedPublicationHistory.create({
        data: {
          aed_id: id,
          previous_mode: currentAed.publication_mode,
          new_mode: body.publication_mode,
          changed_by: user.userId,
          changed_by_role: user.role || "USER",
          change_reason: body.reason || null,
          requires_approval: false, // Could be configured based on role/permissions
          approved_by: user.userId,
          approved_at: new Date(),
          approval_notes: body.notes || null,
        },
      });

      return updatedAed;
    });

    return NextResponse.json({
      success: true,
      message: "Publication mode updated successfully",
      data: result,
      previous_mode: currentAed.publication_mode,
      new_mode: body.publication_mode,
    });
  } catch (error) {
    console.error("Error updating publication mode:", error);
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

/**
 * GET /api/aeds/[id]/publication
 * Get publication history for an AED
 *
 * Response:
 * - Array of publication history entries
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get publication history for this AED
    const history = await prisma.aedPublicationHistory.findMany({
      where: { aed_id: id },
      orderBy: { created_at: "desc" },
      take: 50, // Limit to last 50 entries
    });

    // Get current AED publication_mode
    const aed = await prisma.aed.findUnique({
      where: { id },
      select: {
        publication_mode: true,
        publication_approved_at: true,
        publication_approved_by: true,
      },
    });

    if (!aed) {
      return NextResponse.json(
        {
          success: false,
          error: "AED not found",
          message: `No AED found with ID: ${id}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        current: aed,
        history: history,
        total_changes: history.length,
      },
    });
  } catch (error) {
    console.error("Error fetching publication history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch publication history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
