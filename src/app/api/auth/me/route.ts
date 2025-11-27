import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/jwt";
import type { UserPublic } from "@/types";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get current user from JWT
    const jwtPayload = await getCurrentUser();

    if (!jwtPayload) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Get full user data from database
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
        created_at: true,
        last_login_at: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "Cuenta desactivada" },
        { status: 403 }
      );
    }

    const userPublic: UserPublic = {
      ...user,
    };

    return NextResponse.json({ user: userPublic });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json(
      { error: "Error al obtener usuario" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
