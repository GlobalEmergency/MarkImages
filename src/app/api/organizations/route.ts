/**
 * Organizations API
 * Returns list of organizations for filters and selection
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const isAdmin = user.role === "ADMIN";

    // Get organizations
    let organizations;

    if (isAdmin) {
      // Admin: Get all active organizations
      organizations = await prisma.organization.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
        },
        orderBy: { name: "asc" },
      });
    } else {
      // Non-admin: Only their organizations
      const userOrgs = await prisma.organizationMember.findMany({
        where: {
          user_id: user.userId,
          organization: {
            is_active: true,
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
        },
      });

      organizations = userOrgs.map((m) => m.organization);
    }

    return NextResponse.json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener organizaciones",
      },
      { status: 500 }
    );
  }
}
