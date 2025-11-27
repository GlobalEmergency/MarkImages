import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { createToken, setAuthCookie } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";
import type { AuthResponse, LoginRequest, UserPublic } from "@/types";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: "Cuenta desactivada" },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie
    await setAuthCookie(token);

    const userPublic: UserPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      is_verified: user.is_verified,
      created_at: user.created_at,
      last_login_at: new Date(),
    };

    const response: AuthResponse = {
      user: userPublic,
      message: "Login exitoso",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
