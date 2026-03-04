/**
 * Admin API for managing organizations
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";
import type { CreateOrganizationRequest } from "@/types/organization";
import type { Prisma } from "@/generated/client/client";
import type { OrganizationType } from "@/generated/client/enums";

/**
 * GET /api/admin/organizations
 * List all organizations (with optional filters)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const isActive = searchParams.get("is_active");
    const cityCode = searchParams.get("city_code");

    // Build where clause
    const where: Prisma.OrganizationWhereInput = {};
    if (type) where.type = type as OrganizationType;
    if (isActive) where.is_active = isActive === "true";
    if (cityCode) where.city_code = cityCode;

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        parent_org: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        child_orgs: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            members: true,
            aed_assignments: true,
            verifications: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error fetching organizations:", error);
    const isDevelopment = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch organizations",
        ...(isDevelopment && { details: error instanceof Error ? error.message : "Unknown error" }),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body: CreateOrganizationRequest = await request.json();

    // Validate required fields
    if (!body.type || !body.name) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, name" },
        { status: 400 }
      );
    }

    // Check if code already exists (if provided)
    if (body.code) {
      const existing = await prisma.organization.findUnique({
        where: { code: body.code },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Organization with code '${body.code}' already exists` },
          { status: 409 }
        );
      }
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        type: body.type,
        name: body.name,
        code: body.code || undefined,
        email: body.email || undefined,
        phone: body.phone || undefined,
        website: body.website || undefined,
        description: body.description || undefined,
        scope_type: body.scope_type || "CITY",
        city_code: body.city_code || undefined,
        city_name: body.city_name || undefined,
        district_codes: body.district_codes || [],
        custom_scope_description: body.custom_scope_description || undefined,
        require_approval: body.require_approval ?? true,
        approval_authority: body.approval_authority || undefined,
        badge_name: body.badge_name || undefined,
        badge_icon: body.badge_icon || undefined,
        badge_color: body.badge_color || undefined,
        parent_org_id: body.parent_org_id || undefined,
        is_active: body.is_active ?? true,
        created_by: admin.userId,
      },
      include: {
        parent_org: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: organization,
        message: `Organization '${organization.name}' created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
