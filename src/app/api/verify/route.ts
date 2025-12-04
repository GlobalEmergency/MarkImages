import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Get AEDs that are pending verification (DRAFT or PENDING_REVIEW status)
    // Exclude possible duplicates (they have their own review page)
    const [aeds, totalCount] = await Promise.all([
      prisma.aed.findMany({
        where: {
          status: {
            in: ["DRAFT", "PENDING_REVIEW"],
          },
          NOT: {
            AND: [
              { requires_attention: true },
              {
                attention_reason: {
                  contains: "duplicado",
                  mode: "insensitive",
                },
              },
            ],
          },
        },
        include: {
          location: true,
          images: {
            where: {
              is_verified: false,
            },
            orderBy: {
              order: "asc",
            },
            take: 3,
          },
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.aed.count({
        where: {
          status: {
            in: ["DRAFT", "PENDING_REVIEW"],
          },
          NOT: {
            AND: [
              { requires_attention: true },
              {
                attention_reason: {
                  contains: "duplicado",
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      }),
    ]);

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
    });
  } catch (error) {
    console.error("Error fetching AEDs for verification:", error);
    return NextResponse.json({ error: "Error al cargar DEAs" }, { status: 500 });
  }
}
