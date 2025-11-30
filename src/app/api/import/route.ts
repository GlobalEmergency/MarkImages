/**
 * API Route: /api/import
 * GET - Lista las importaciones del usuario autenticado
 * POST - Inicia la importación de un batch de DEAs desde CSV
 */

import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/jwt";

const prisma = new PrismaClient();

/**
 * GET /api/import
 * Lista las importaciones del usuario autenticado con paginación
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Obtener batches del usuario
    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where: { imported_by: user.userId },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              errors: true,
              aeds: true,
            },
          },
        },
      }),
      prisma.importBatch.count({
        where: { imported_by: user.userId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        success: true,
        batches,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching import batches:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Parsear FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const batchName = formData.get("batchName") as string | null;

    // Validar campos requeridos
    if (!file) {
      return NextResponse.json({ error: "El archivo CSV es requerido" }, { status: 400 });
    }

    if (!batchName) {
      return NextResponse.json(
        { error: "El nombre del batch es requerido" },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos CSV" },
        { status: 400 }
      );
    }

    // Validar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo no debe superar los 10MB" },
        { status: 400 }
      );
    }

    // Guardar archivo temporalmente
    const { saveTempFile, processImportAsync } = await import("@/lib/importProcessor");
    const tempFilePath = await saveTempFile(file);

    // Crear batch inicial con estado PENDING
    const batch = await prisma.importBatch.create({
      data: {
        name: batchName,
        description: `Importación desde archivo ${file.name}`,
        source_origin: "CSV_IMPORT",
        file_name: file.name,
        file_size: file.size,
        status: "PENDING",
        total_records: 0,
        successful_records: 0,
        failed_records: 0,
        warning_records: 0,
        imported_by: user.userId,
      },
    });

    // Iniciar procesamiento asíncrono (no bloquear la respuesta)
    // Se ejecuta en background sin await
    processImportAsync(batch.id, tempFilePath, user.userId).catch((error) => {
      console.error(`❌ Background import failed for batch ${batch.id}:`, error);
    });

    // Retornar inmediatamente con batchId
    return NextResponse.json(
      {
        success: true,
        message: "Importación iniciada",
        batchId: batch.id,
        status: "PENDING",
      },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
    console.error("❌ Import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
