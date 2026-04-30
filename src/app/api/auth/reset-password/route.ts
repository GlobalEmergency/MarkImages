import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/password";
import { authRateLimiter } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token es requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = authRateLimiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const validatedData = resetPasswordSchema.parse(body);

    // Validate password strength
    const passwordValidation = validatePassword(validatedData.password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join(", ") }, { status: 400 });
    }

    // Hash the provided token to compare against stored hash
    const tokenHash = crypto.createHash("sha256").update(validatedData.token).digest("hex");

    // Find user with valid reset token (compared by hash)
    const user = await prisma.user.findFirst({
      where: {
        reset_token: tokenHash,
        reset_token_expires: {
          gte: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "El token de recuperación es inválido o ha expirado. Por favor, solicita un nuevo enlace de recuperación.",
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(validatedData.password);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
      },
    });

    return NextResponse.json(
      {
        message:
          "Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Error al restablecer la contraseña" }, { status: 500 });
  }
}
