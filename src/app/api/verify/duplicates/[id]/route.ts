import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/verify/duplicates/[id]
 * Obtiene los detalles de un DEA posible duplicado y su candidato similar
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Obtener el DEA posible duplicado
    const aed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: true,
        images: {
          orderBy: { order: "asc" },
        },
        responsible: true,
        schedule: true,
      },
    });

    if (!aed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    if (!aed.requires_attention || !aed.attention_reason?.includes("duplicado")) {
      return NextResponse.json(
        { error: "Este DEA no está marcado como posible duplicado" },
        { status: 400 }
      );
    }

    // Extraer información del candidato similar del attention_reason
    const candidateNameMatch = aed.attention_reason.match(/Similar a "([^"]+)"/);
    const candidateAddressMatch = aed.attention_reason.match(/en "([^"]+)"/);
    const scoreMatch = aed.attention_reason.match(/score:\s*(\d+)/);

    const candidateName = candidateNameMatch?.[1];
    const candidateAddress = candidateAddressMatch?.[1];
    const similarityScore = scoreMatch ? parseInt(scoreMatch[1]) : null;

    // Buscar el candidato similar en la base de datos
    let candidateAed = null;
    if (candidateName && candidateAddress) {
      // Buscar por nombre y dirección similar
      const candidates = await prisma.aed.findMany({
        where: {
          name: {
            contains: candidateName,
            mode: "insensitive",
          },
          status: {
            in: ["PUBLISHED", "PENDING_REVIEW"],
          },
          id: {
            not: id, // Excluir el DEA actual
          },
        },
        include: {
          location: true,
          images: {
            orderBy: { order: "asc" },
          },
          responsible: true,
          schedule: true,
        },
        take: 5,
      });

      // Buscar el que mejor coincide con la dirección
      candidateAed = candidates.find((candidate) => {
        const fullAddress =
          `${candidate.location?.street_type || ""} ${candidate.location?.street_name || ""} ${candidate.location?.street_number || ""}`.trim();
        return (
          fullAddress.toLowerCase().includes(candidateAddress.toLowerCase()) ||
          candidateAddress.toLowerCase().includes(fullAddress.toLowerCase())
        );
      });

      // Si no se encontró por dirección, tomar el primero
      if (!candidateAed && candidates.length > 0) {
        candidateAed = candidates[0];
      }
    }

    return NextResponse.json({
      aed,
      candidateAed,
      comparison: {
        similarityScore,
        extractedCandidateName: candidateName,
        extractedCandidateAddress: candidateAddress,
      },
    });
  } catch (error) {
    console.error("Error fetching duplicate details:", error);
    return NextResponse.json({ error: "Error al cargar detalles del duplicado" }, { status: 500 });
  }
}

/**
 * PUT /api/verify/duplicates/[id]
 * Actualiza el estado de un posible duplicado
 * Actions: "not_duplicate" | "confirm_duplicate"
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, notes } = body;

    if (!action || !["not_duplicate", "confirm_duplicate"].includes(action)) {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const aed = await prisma.aed.findUnique({
      where: { id },
    });

    if (!aed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    if (action === "not_duplicate") {
      // Quitar la marca de posible duplicado
      const updatedAed = await prisma.aed.update({
        where: { id },
        data: {
          requires_attention: false,
          attention_reason: null,
          internal_notes: notes
            ? `${aed.internal_notes || ""}\n\n[${new Date().toISOString()}] Revisión de duplicado por ${user.email}: No es duplicado. ${notes}`.trim()
            : aed.internal_notes,
          updated_by: user.userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "DEA marcado como no duplicado",
        aed: updatedAed,
      });
    } else if (action === "confirm_duplicate") {
      // Marcar como rechazado (duplicado confirmado)
      const rejectionReason = `Duplicado confirmado durante revisión manual. ${notes || ""}`.trim();

      const updatedAed = await prisma.aed.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejection_reason: rejectionReason,
          requires_attention: false,
          attention_reason: null,
          internal_notes: notes
            ? `${aed.internal_notes || ""}\n\n[${new Date().toISOString()}] Revisión de duplicado por ${user.email}: Duplicado confirmado. ${notes}`.trim()
            : aed.internal_notes,
          updated_by: user.userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "DEA marcado como duplicado y rechazado",
        aed: updatedAed,
      });
    }

    return NextResponse.json({ error: "Acción no procesada" }, { status: 400 });
  } catch (error) {
    console.error("Error updating duplicate status:", error);
    return NextResponse.json(
      { error: "Error al actualizar estado del duplicado" },
      { status: 500 }
    );
  }
}
