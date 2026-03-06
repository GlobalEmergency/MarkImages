/**
 * Admin API for managing AED verifications by organizations
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/organizations/[id]/verifications
 * Get all verifications performed by an organization
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(request);
  const { id } = await params;

  try {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const verifications = await prisma.aedOrganizationVerification.findMany({
      where: { organization_id: id },
      include: {
        aed: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            location: {
              select: {
                street_name: true,
                street_number: true,
                city_name: true,
              },
            },
          },
        },
      },
      orderBy: { verified_at: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        organization_id: id,
        verifications,
      },
    });
  } catch (error) {
    console.error("Error fetching verifications:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch verifications",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations/[id]/verifications
 * Create a new verification record
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  const { id } = await params;

  try {
    const body = await request.json();
    const {
      aed_id,
      verification_type = "INFORMAL",
      verified_address = false,
      verified_schedule = false,
      verified_photos = false,
      verified_access = false,
      verified_signage = false,
      certificate_number,
      certificate_expiry,
      notes,
    } = body;

    // Validate required fields
    if (!aed_id) {
      return NextResponse.json({ success: false, error: "aed_id is required" }, { status: 400 });
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if AED exists
    const aed = await prisma.aed.findUnique({
      where: { id: aed_id },
    });

    if (!aed) {
      return NextResponse.json({ success: false, error: "AED not found" }, { status: 404 });
    }

    const now = new Date();

    // Wrap all writes in a transaction to avoid inconsistent state
    const verification = await prisma.$transaction(async (tx) => {
      // 1. Mark previous verifications from this org for this AED as superseded
      await tx.aedOrganizationVerification.updateMany({
        where: {
          aed_id,
          organization_id: id,
          is_current: true,
        },
        data: {
          is_current: false,
          superseded_at: now,
        },
      });

      // 2. Create the new verification
      const created = await tx.aedOrganizationVerification.create({
        data: {
          aed_id,
          organization_id: id,
          verification_type,
          verified_by: admin.userId,
          verified_at: now,
          verified_address,
          verified_schedule,
          verified_photos,
          verified_access,
          verified_signage,
          certificate_number,
          certificate_expiry: certificate_expiry ? new Date(certificate_expiry) : null,
          is_current: true,
          notes,
        },
        include: {
          aed: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // 3. Update the AED's verification timestamp
      await tx.aed.update({
        where: { id: aed_id },
        data: {
          last_verified_at: now,
          verification_method: verification_type,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        data: verification,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating verification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create verification",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
