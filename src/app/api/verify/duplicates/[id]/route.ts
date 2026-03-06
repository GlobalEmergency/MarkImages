import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateStatusTransition } from "@/lib/aed-status";
import { recordStatusChange, recordFieldChange, appendInternalNote } from "@/lib/audit";

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
    await requireAuth(request);
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

    // Check if marked as requires_attention (duplicate detection info is now in internal_notes)
    if (!aed.requires_attention) {
      return NextResponse.json(
        { error: "Este DEA no está marcado como posible duplicado" },
        { status: 400 }
      );
    }

    // Try to extract duplicate information from internal_notes (JSON array)
    let candidateName: string | null = null;
    let candidateAddress: string | null = null;
    let similarityScore: number | null = null;

    if (aed.internal_notes && Array.isArray(aed.internal_notes)) {
      // Look for a duplicate-type note
      const duplicateNote = (aed.internal_notes as Array<{ text?: string; type?: string }>).find(
        (note) => note.type === "duplicate" || note.text?.includes("duplicado")
      );
      if (duplicateNote?.text) {
        const nameMatch = duplicateNote.text.match(/Similar a "([^"]+)"/);
        const addressMatch = duplicateNote.text.match(/en "([^"]+)"/);
        const scoreMatch = duplicateNote.text.match(/score:\s*(\d+)/);

        candidateName = nameMatch?.[1] || null;
        candidateAddress = addressMatch?.[1] || null;
        similarityScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
      }
    }

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
      const noteText =
        `Revisión de duplicado por ${user.email}: No es duplicado. ${notes || ""}`.trim();
      const updatedNotes = appendInternalNote(
        aed.internal_notes,
        noteText,
        "duplicate_review",
        user.email || user.userId
      );

      // Wrap update + audit in a single transaction
      const updatedAed = await prisma.$transaction(async (tx) => {
        const updated = await tx.aed.update({
          where: { id },
          data: {
            requires_attention: false,
            internal_notes: updatedNotes,
            updated_by: user.userId,
          },
        });

        await recordFieldChange(tx, {
          aedId: id,
          fieldName: "requires_attention",
          oldValue: "true",
          newValue: "false",
          changedBy: user.userId,
          changeSource: "WEB_UI",
        });

        return updated;
      });

      return NextResponse.json({
        success: true,
        message: "DEA marcado como no duplicado",
        aed: updatedAed,
      });
    } else if (action === "confirm_duplicate") {
      // Validate status transition via state machine
      try {
        validateStatusTransition(aed.status, "REJECTED");
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: `No se puede rechazar un DEA en estado ${aed.status}. Solo se pueden rechazar DEAs en PENDING_REVIEW.`,
          },
          { status: 400 }
        );
      }

      const rejectionReason = `Duplicado confirmado durante revisión manual. ${notes || ""}`.trim();
      const noteText =
        `Revisión de duplicado por ${user.email}: Duplicado confirmado. ${notes || ""}`.trim();
      const updatedNotes = appendInternalNote(
        aed.internal_notes,
        noteText,
        "duplicate_review",
        user.email || user.userId
      );

      // Wrap update + audit in a single transaction
      const updatedAed = await prisma.$transaction(async (tx) => {
        const updated = await tx.aed.update({
          where: { id },
          data: {
            status: "REJECTED",
            rejection_reason: rejectionReason,
            requires_attention: false,
            internal_notes: updatedNotes,
            updated_by: user.userId,
          },
        });

        await recordStatusChange(tx, {
          aedId: id,
          previousStatus: aed.status,
          newStatus: "REJECTED",
          modifiedBy: user.userId,
          reason: rejectionReason,
          notes: `Duplicado confirmado por ${user.email}`,
        });

        return updated;
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
