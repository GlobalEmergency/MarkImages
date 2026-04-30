import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/jwt";
import { hashPassword, validatePassword } from "@/lib/password";
import { authRateLimiter } from "@/lib/rate-limit";
import type { AuthResponse, RegisterRequest, UserPublic } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = authRateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body: RegisterRequest = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join(", ") }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password_hash,
        name,
      },
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

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie
    await setAuthCookie(token);

    const userPublic: UserPublic = {
      ...user,
    };

    const response: AuthResponse = {
      user: userPublic,
      token,
      message: "Usuario registrado exitosamente",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);

    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : "Error al registrar usuario";
    const isDevelopment = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        error: "Error al registrar usuario",
        ...(isDevelopment && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
