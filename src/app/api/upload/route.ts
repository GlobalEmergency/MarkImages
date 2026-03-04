import { NextRequest, NextResponse } from "next/server";

import { UploadImageUseCase } from "@/storage/application/use-cases/UploadImageUseCase";
import { S3ImageStorageAdapter } from "@/storage/infrastructure/adapters/S3ImageStorageAdapter";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Require authentication for image uploads
    await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "dea-foto";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    // Inyección de dependencias: Adapter → Use Case
    const imageStorage = new S3ImageStorageAdapter();
    const uploadImageUseCase = new UploadImageUseCase(imageStorage);

    // Ejecutar use case
    const result = await uploadImageUseCase.execute({
      file,
      filename: file.name,
      contentType: file.type,
      prefix,
    });

    return NextResponse.json(
      {
        url: result.url,
        key: result.key,
        size: result.size,
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir el archivo" },
      { status: 500 }
    );
  }
}
