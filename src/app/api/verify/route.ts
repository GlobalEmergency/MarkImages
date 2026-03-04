import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getVerifiableAedsForUser, VerificationFilterType } from "@/lib/organization-permissions";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);
    const organizationId = searchParams.get("organization_id") || undefined;
    const filterType = (searchParams.get("filter_type") || "pending") as VerificationFilterType;
    const search = searchParams.get("search") || undefined;

    // Validate filter_type
    const validFilterTypes: VerificationFilterType[] = [
      "pending",
      "published_unverified",
      "published_verified",
      "all_published",
    ];
    if (!validFilterTypes.includes(filterType)) {
      return NextResponse.json({ error: "Tipo de filtro no válido" }, { status: 400 });
    }

    // Get AEDs based on user's role and organization memberships
    const { aeds, totalCount, userOrganizations } = await getVerifiableAedsForUser(
      user.userId,
      user.role,
      {
        page,
        limit,
        organization_id: organizationId,
        filter_type: filterType,
        search,
      }
    );

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: aeds,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      userOrganizations: userOrganizations.map((om) => ({
        id: om.organization.id,
        name: om.organization.name,
        type: om.organization.type,
        role: om.role,
        can_verify: om.can_verify,
      })),
      isAdmin: user.role === "ADMIN",
    });
  } catch (error) {
    console.error("Error fetching AEDs for verification:", error);
    return NextResponse.json({ error: "Error al cargar DEAs" }, { status: 500 });
  }
}
