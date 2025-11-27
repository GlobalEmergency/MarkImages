import { NextResponse } from "next/server";

import { removeAuthCookie } from "@/lib/jwt";

export async function POST() {
  try {
    // Remove auth cookie
    await removeAuthCookie();

    return NextResponse.json({
      message: "Logout exitoso",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    );
  }
}
