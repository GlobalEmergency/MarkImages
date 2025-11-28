import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    // Require authentication for image uploads
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "dea-foto";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    // Validate file type (only images)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no válido. Solo se permiten imágenes." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 10MB." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const url = await uploadToS3({
      buffer,
      filename: file.name,
      contentType: file.type,
      prefix,
    });

    return NextResponse.json({ url, success: true }, { status: 200 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir el archivo" },
      { status: 500 }
    );
  }
}
