import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface DuplicateAedData {
  id: string;
  name: string;
  code: string | null;
  provisional_number: number | null;
  establishment_type: string | null;
  latitude: number | null;
  longitude: number | null;
  internal_notes: Array<{ text?: string; [key: string]: unknown }> | null;
  status: string;
  location: {
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
    postal_code: string | null;
    district_name: string | null;
    neighborhood_name: string | null;
    location_details: string | null;
    floor: string | null;
  } | null;
  images: Array<{
    id: string;
    original_url: string;
    type: string | null;
  }>;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * GET /api/verify/duplicates
 * Lista todos los DEAs marcados como posibles duplicados
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Filtros opcionales
    const district = searchParams.get("district");
    const establishmentType = searchParams.get("establishment_type");
    const minScore = searchParams.get("min_score");
    const maxScore = searchParams.get("max_score");

    // Construir WHERE clause - Now we just filter by requires_attention
    // Duplicate info is stored in internal_notes JSON
    const whereClause: Record<string, unknown> = {
      requires_attention: true,
      status: {
        in: ["DRAFT", "PENDING_REVIEW"],
      },
    };

    if (establishmentType) {
      whereClause.establishment_type = establishmentType;
    }

    // Obtener DEAs con posibles duplicados
    const [aeds, totalCount] = await Promise.all([
      prisma.aed.findMany({
        where: whereClause,
        include: {
          location: {
            select: {
              street_type: true,
              street_name: true,
              street_number: true,
              postal_code: true,
              district_name: true,
              neighborhood_name: true,
              location_details: true,
              floor: true,
            },
          },
          images: {
            select: {
              id: true,
              original_url: true,
              type: true,
            },
            orderBy: {
              order: "asc",
            },
            take: 2,
          },
        },
        orderBy: [
          { location: { street_name: "asc" } },
          { location: { street_number: "asc" } },
          { created_at: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.aed.count({
        where: whereClause,
      }),
    ]);

    // Filtrar por score si se especifica (search in internal_notes JSON)
    let filteredAeds = aeds as DuplicateAedData[];
    if (minScore || maxScore) {
      filteredAeds = filteredAeds.filter((aed) => {
        if (!aed.internal_notes || !Array.isArray(aed.internal_notes)) return false;

        // Look for duplicate note with score
        const duplicateNote = aed.internal_notes.find((n) => n.text?.includes("score:"));
        if (!duplicateNote?.text) return false;

        const scoreMatch = duplicateNote.text.match(/score:\s*(\d+)/);
        if (!scoreMatch) return false;

        const score = parseInt(scoreMatch[1], 10);
        if (minScore && score < parseInt(minScore, 10)) return false;
        if (maxScore && score > parseInt(maxScore, 10)) return false;

        return true;
      });
    }

    // Filtrar por distrito si se especifica
    if (district) {
      filteredAeds = filteredAeds.filter((aed) => aed.location?.district_name === district);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: filteredAeds,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      } as PaginationInfo,
    });
  } catch (error) {
    console.error("Error fetching possible duplicates:", error);
    return NextResponse.json({ error: "Error al cargar posibles duplicados" }, { status: 500 });
  }
}
