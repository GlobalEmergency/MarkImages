import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VerificationStep } from "@/types/verification";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Get the AED with all necessary data
    const aed = await prisma.aed.findUnique({
      where: { id },
      include: {
        location: {
          include: {
            district: true,
            neighborhood: true,
            street: true,
            address_validation: true,
          },
        },
        images: {
          orderBy: {
            order: "asc",
          },
        },
        responsible: true,
        validations: {
          where: {
            type: "ADDRESS",
          },
          orderBy: {
            created_at: "desc",
          },
          take: 1,
        },
      },
    });

    if (!aed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    // Check if there's an active validation session
    let validation = aed.validations[0];

    if (!validation || validation.status === "COMPLETED") {
      // Create a new validation session
      validation = await prisma.aedValidation.create({
        data: {
          aed_id: aed.id,
          type: "IMAGES", // We'll use IMAGES type for the full verification
          status: "IN_PROGRESS",
          verified_by: user.userId,
          data: {
            current_step: VerificationStep.ADDRESS_VALIDATION,
            user_id: user.userId,
          },
        },
        include: {
          sessions: true,
        },
      });
    }

    const validationData = validation.data as { current_step?: string; user_id?: string } | null;

    return NextResponse.json({
      aed,
      validation,
      current_step: validationData?.current_step || VerificationStep.ADDRESS_VALIDATION,
    });
  } catch (error) {
    console.error("Error fetching verification session:", error);
    return NextResponse.json({ error: "Error al cargar sesión de verificación" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { step, data } = body;

    // Find the active validation
    const validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
    });

    if (!validation) {
      return NextResponse.json({ error: "Sesión de verificación no encontrada" }, { status: 404 });
    }

    // Update the validation with new step and data
    const updatedValidation = await prisma.aedValidation.update({
      where: { id: validation.id },
      data: {
        data: {
          ...((validation.data as object) || {}),
          current_step: step,
          ...data,
        },
        updated_at: new Date(),
      },
    });

    // Create a session record for this step
    await prisma.validationSession.create({
      data: {
        validation_id: validation.id,
        step,
        step_data: data,
        is_completed: false,
      },
    });

    return NextResponse.json(updatedValidation);
  } catch (error) {
    console.error("Error updating verification session:", error);
    return NextResponse.json({ error: "Error al actualizar sesión" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Find and delete the active validation
    const validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
    });

    if (validation) {
      await prisma.aedValidation.delete({
        where: { id: validation.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling verification:", error);
    return NextResponse.json({ error: "Error al cancelar verificación" }, { status: 500 });
  }
}
