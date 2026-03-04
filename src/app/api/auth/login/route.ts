import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";
import { authRateLimiter } from "@/lib/rate-limit";
import type { AuthResponse, LoginRequest, UserPublic } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = authRateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    // Verify password and check active status
    // Use a unified error message to prevent account enumeration
    const isValidPassword = user.is_active
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!isValidPassword) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
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
      token, // Included for mobile app (Bearer auth); web clients use the httpOnly cookie
      message: "Login exitoso",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Login error:", error);

    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : "Error al iniciar sesión";
    const isDevelopment = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        error: "Error al iniciar sesión",
        ...(isDevelopment && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
