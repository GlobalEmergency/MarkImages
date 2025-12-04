/**
 * API Route: /api/import
 * GET - Lista las importaciones del usuario autenticado
 * POST - Inicia la importación de un batch de DEAs desde CSV
 */

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/jwt";
import { prisma } from "@/lib/db";

/**
 * GET /api/import
 * Lista las importaciones del usuario autenticado con paginación
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

    const contentType = request.headers.get("content-type") || "";
    const { processImportAsync } = await import("@/lib/importProcessor");

    let tempFilePath: string;
    let fileName: string;
    let fileSize: number;
    let batchName: string;
    let mappings: Array<{ csvColumn: string; systemField: string }> | undefined;
    let sharepointCookies: Record<string, string> | undefined;

    // Detectar si es JSON (wizard flow) o FormData (direct upload)
    if (contentType.includes("application/json")) {
      // Flujo del wizard: archivo ya guardado en servidor
      const body = await request.json();
      const filePath = body.filePath as string | undefined;
      mappings = body.mappings as Array<{ csvColumn: string; systemField: string }> | undefined;
      sharepointCookies = body.sharepointCookies as Record<string, string> | undefined;
      batchName =
        (body.batchName as string | undefined) || `Importación ${new Date().toLocaleString()}`;

      if (!filePath) {
        return NextResponse.json({ error: "El filePath es requerido" }, { status: 400 });
      }

      // Validaciones de seguridad
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");

      // Normalizar y validar que el path esté dentro del directorio temporal
      const normalizedPath = path.normalize(filePath);
      const tempDir = os.tmpdir();

      if (!normalizedPath.startsWith(tempDir)) {
        return NextResponse.json({ error: "Ruta de archivo no válida" }, { status: 400 });
      }

      // Verificar que el archivo existe
      try {
        const stats = await fs.stat(normalizedPath);
        fileSize = stats.size;
        fileName = path.basename(normalizedPath);
        tempFilePath = normalizedPath;
      } catch {
        return NextResponse.json({ error: "El archivo especificado no existe" }, { status: 404 });
      }
    } else {
      // Flujo tradicional: FormData con archivo
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      batchName =
        (formData.get("batchName") as string | null) ||
        `Importación ${new Date().toLocaleString()}`;

      if (!file) {
        return NextResponse.json({ error: "El archivo CSV es requerido" }, { status: 400 });
      }

      // Validar tipo de archivo
      if (!file.name.endsWith(".csv")) {
        return NextResponse.json({ error: "Solo se permiten archivos CSV" }, { status: 400 });
      }

      // Validar tamaño (10MB máximo)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return NextResponse.json({ error: "El archivo no debe superar los 10MB" }, { status: 400 });
      }

      // Guardar archivo temporalmente
      const { saveTempFile } = await import("@/lib/importProcessor");
      tempFilePath = await saveTempFile(file);
      fileName = file.name;
      fileSize = file.size;
    }

    // Preparar import_parameters
    const importParameters: any = {};
    if (mappings) {
      importParameters.mappings = mappings;
    }
    if (sharepointCookies) {
      importParameters.sharepointAuth = {
        cookies: sharepointCookies,
        validatedAt: new Date().toISOString(),
      };
    }

    // Crear batch inicial con estado PENDING
    const batch = await prisma.importBatch.create({
      data: {
        name: batchName,
        description: `Importación desde archivo ${fileName}`,
        source_origin: "CSV_IMPORT",
        file_name: fileName,
        file_size: fileSize,
        status: "PENDING",
        total_records: 0,
        successful_records: 0,
        failed_records: 0,
        warning_records: 0,
        imported_by: user.userId,
        import_parameters: Object.keys(importParameters).length > 0 ? importParameters : undefined,
      },
    });

    // Iniciar procesamiento asíncrono (no bloquear la respuesta)
    processImportAsync(batch.id, tempFilePath, user.userId, mappings).catch((error) => {
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
