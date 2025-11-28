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
      },
    });

    if (!aed) {
      return NextResponse.json({ error: "DEA no encontrado" }, { status: 404 });
    }

    // Get the active validation session with a direct query (avoid nested include caching issues)
    let validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        sessions: true,
      },
    });

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
    const currentStep = validationData?.current_step || VerificationStep.ADDRESS_VALIDATION;

    console.log("=== GET /api/verify/[id] - Returning data ===");
    console.log("Validation ID:", validation.id);
    console.log("Validation status:", validation.status);
    console.log("Validation created at:", validation.created_at);
    console.log("Validation data (full):", validation.data);
    console.log("Extracted current_step:", validationData?.current_step);
    console.log("Final current_step to return:", currentStep);

    return NextResponse.json({
      aed,
      validation,
      current_step: currentStep,
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

    console.log("=== PUT /api/verify/[id] - Updating step ===");
    console.log("AED ID:", id);
    console.log("New step:", step);
    console.log("Step data:", data);

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

    console.log("Found validation:", validation.id);
    console.log("Current validation data:", validation.data);

    // Update the validation with new step and data
    // IMPORTANT: current_step must be last to avoid being overwritten by stepData
    const updatedValidation = await prisma.aedValidation.update({
      where: { id: validation.id },
      data: {
        data: {
          ...((validation.data as object) || {}),
          ...data,
          current_step: step, // Must be last to ensure it's not overwritten
        },
        updated_at: new Date(),
      },
    });

    console.log("Updated validation data:", updatedValidation.data);
    console.log("Confirmed current_step in DB:", (updatedValidation.data as any)?.current_step);

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
