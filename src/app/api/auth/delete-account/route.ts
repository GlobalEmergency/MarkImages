import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { removeAuthCookie } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";
import { requireAuth } from "@/lib/auth";
import { AuthError } from "@/lib/auth";

/**
 * DELETE /api/auth/delete-account
 *
 * Anonymizes the user's personal data (email, name, password) and deactivates the account.
 * Keeps the user record and all related data (AEDs, audit logs) intact for data integrity.
 * Removes organization memberships to revoke all permissions.
 *
 * Requires password confirmation for security.
 */
export async function DELETE(request: NextRequest) {
  try {
    const jwtUser = await requireAuth(request);

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "La contraseña es obligatoria para confirmar la eliminación" },
        { status: 400 }
      );
    }

    // Fetch full user record to verify password
    const user = await prisma.user.findUnique({
      where: { id: jwtUser.userId },
    });

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }

    // Anonymize user data and remove org memberships in a single transaction
    const anonymizedEmail = `deleted_${user.id}@deleted.deamap.es`;

    await prisma.$transaction([
      // Anonymize personal data
      prisma.user.update({
        where: { id: user.id },
        data: {
          email: anonymizedEmail,
          name: "Usuario eliminado",
          password_hash: "ACCOUNT_DELETED",
          is_active: false,
          is_verified: false,
          verification_token: null,
          reset_token: null,
          reset_token_expires: null,
        },
      }),
      // Remove all organization memberships (revoke permissions)
      prisma.organizationMember.deleteMany({
        where: { user_id: user.id },
      }),
    ]);

    // Clear auth cookie
    await removeAuthCookie();

    return NextResponse.json({
      message: "Cuenta eliminada correctamente. Tus datos personales han sido borrados.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Error al eliminar la cuenta" }, { status: 500 });
  }
}
