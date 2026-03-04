import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verificar que el usuario pertenece a la organización
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organization_id: orgId,
        user_id: user.userId,
      },
    });

    if (!membership && user.role !== "ADMIN") {
      return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
    }

    // Obtener estadísticas
    const [
      totalDeas,
      verifiedDeas,
      pendingVerifications,
      membersCount,
      verificationsThisMonth,
      deasByStatus,
    ] = await Promise.all([
      // Total de DEAs asignados a la organización
      prisma.aedOrganizationAssignment.count({
        where: {
          organization_id: orgId,
          status: "ACTIVE",
        },
      }),

      // DEAs verificados
      prisma.aedOrganizationAssignment.count({
        where: {
          organization_id: orgId,
          status: "ACTIVE",
          assignment_type: "VERIFICATION",
          aed: {
            last_verified_at: {
              not: null,
            },
          },
        },
      }),

      // Verificaciones pendientes
      prisma.aedOrganizationAssignment.count({
        where: {
          organization_id: orgId,
          status: "ACTIVE",
          assignment_type: "VERIFICATION",
          aed: {
            OR: [
              { last_verified_at: null },
              {
                last_verified_at: {
                  lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Más de 1 año
                },
              },
            ],
          },
        },
      }),

      // Número de miembros
      prisma.organizationMember.count({
        where: {
          organization_id: orgId,
        },
      }),

      // Verificaciones realizadas este mes
      prisma.aedOrganizationVerification.count({
        where: {
          organization_id: orgId,
          verified_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),

      // DEAs por estado
      prisma.aed.groupBy({
        by: ["status"],
        where: {
          assignments: {
            some: {
              organization_id: orgId,
              status: "ACTIVE",
            },
          },
        },
        _count: true,
      }),
    ]);

    // Procesar DEAs por estado
    const deasByStatusMap = {
      active: 0,
      inactive: 0,
      pending: 0,
    };

    deasByStatus.forEach((item) => {
      if (item.status === "PUBLISHED") {
        deasByStatusMap.active += item._count;
      } else if (item.status === "INACTIVE" || item.status === "REJECTED") {
        deasByStatusMap.inactive += item._count;
      } else if (item.status === "DRAFT" || item.status === "PENDING_REVIEW") {
        deasByStatusMap.pending += item._count;
      }
    });

    // Add verifications pending to the pending count
    deasByStatusMap.pending += pendingVerifications;

    return NextResponse.json({
      total_deas: totalDeas,
      verified_deas: verifiedDeas,
      pending_verifications: pendingVerifications,
      members_count: membersCount,
      verifications_this_month: verificationsThisMonth,
      deas_by_status: deasByStatusMap,
    });
  } catch (error) {
    console.error("Error fetching organization stats:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
