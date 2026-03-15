/**
 * Admin API para gestionar una fuente de datos específica
 * Solo accesible para usuarios con rol ADMIN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/data-sources/[id]
 * Obtiene los detalles de una fuente de datos
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
      include: {
        batch_jobs: {
          orderBy: { created_at: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            status: true,
            total_records: true,
            successful_records: true,
            failed_records: true,
            created_at: true,
            completed_at: true,
          },
        },
        _count: {
          select: {
            managed_aeds: true,
            batch_jobs: true,
          },
        },
      },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    // Extraer campos según el tipo de fuente de datos
    const config = dataSource.config as Record<string, unknown> | null;

    // Campos específicos de CKAN_API
    const apiEndpoint = config?.apiEndpoint as string | null;
    const resourceId = config?.resourceId as string | null;

    // Campos específicos de JSON_FILE
    const fileUrl = config?.fileUrl as string | null;
    const jsonPath = config?.jsonPath as string | null;

    // Campos específicos de CSV_FILE
    const filePath = config?.filePath as string | null;

    // Campos comunes
    const fieldMapping = config?.fieldMapping as Record<string, string> | null;

    // Formatear respuesta
    const response = {
      id: dataSource.id,
      name: dataSource.name,
      description: dataSource.description,
      type: dataSource.type,
      config: dataSource.config,
      // Campos específicos extraídos según tipo
      apiEndpoint, // CKAN_API
      resourceId, // CKAN_API
      fileUrl, // JSON_FILE
      jsonPath, // JSON_FILE
      filePath, // CSV_FILE
      fieldMapping, // Común a todos
      isActive: dataSource.is_active,
      matchingStrategy: dataSource.matching_strategy,
      matchingThreshold: dataSource.matching_threshold,
      syncFrequency: dataSource.sync_frequency,
      defaultPublicationMode: dataSource.default_publication_mode,
      lastSyncAt: dataSource.last_sync_at,
      nextScheduledSyncAt: dataSource.next_scheduled_sync_at,
      autoDeactivateMissing: dataSource.auto_deactivate_missing,
      autoUpdateFields: dataSource.auto_update_fields,
      sourceOrigin: dataSource.source_origin,
      regionCode: dataSource.region_code,
      // Contadores globales de sincronización
      totalRecordsSync: dataSource.total_records_sync,
      recordsCreated: dataSource.records_created,
      recordsUpdated: dataSource.records_updated,
      recordsDeactivated: dataSource.records_deactivated,
      stats: {
        totalAeds: dataSource._count.managed_aeds,
        totalBatches: dataSource._count.batch_jobs,
      },
      recentBatches: dataSource.batch_jobs.map((batch) => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        totalRecords: batch.total_records,
        successfulRecords: batch.successful_records,
        failedRecords: batch.failed_records,
        createdAt: batch.created_at,
        completedAt: batch.completed_at,
      })),
      createdAt: dataSource.created_at,
      updatedAt: dataSource.updated_at,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching data source:", error);
    return NextResponse.json({ error: "Error al obtener la fuente de datos" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/data-sources/[id]
 * Actualiza una fuente de datos
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();

    // Verificar que existe
    const existing = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (body.name && body.name !== existing.name) {
      const nameExists = await prisma.externalDataSource.findUnique({
        where: { name: body.name },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: "Ya existe otra fuente de datos con ese nombre" },
          { status: 409 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) {
      const validTypes = ["CSV_FILE", "CKAN_API", "JSON_FILE", "REST_API"];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Tipo inválido. Valores permitidos: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }
    if (body.config !== undefined) updateData.config = body.config;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.matchingStrategy !== undefined) updateData.matching_strategy = body.matchingStrategy;
    if (body.matchingThreshold !== undefined)
      updateData.matching_threshold = body.matchingThreshold;
    if (body.syncFrequency !== undefined) updateData.sync_frequency = body.syncFrequency;
    if (body.defaultPublicationMode !== undefined)
      updateData.default_publication_mode = body.defaultPublicationMode;
    if (body.autoDeactivateMissing !== undefined)
      updateData.auto_deactivate_missing = body.autoDeactivateMissing;
    if (body.autoUpdateFields !== undefined) updateData.auto_update_fields = body.autoUpdateFields;

    const dataSource = await prisma.externalDataSource.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: dataSource.id,
        name: dataSource.name,
        isActive: dataSource.is_active,
        updatedAt: dataSource.updated_at,
      },
      message: "Fuente de datos actualizada exitosamente",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error updating data source:", error);
    return NextResponse.json({ error: "Error al actualizar la fuente de datos" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/data-sources/[id]
 * Elimina una fuente de datos (solo si no tiene AEDs asociados)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // Verificar que existe y obtener conteo de AEDs
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            managed_aeds: true,
          },
        },
      },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    // Verificar que no tenga AEDs asociados
    if (dataSource._count.managed_aeds > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: hay ${dataSource._count.managed_aeds} AEDs asociados a esta fuente`,
          suggestion: "Primero desasocie o elimine los AEDs vinculados",
        },
        { status: 409 }
      );
    }

    // Delete batch jobs and data source atomically
    await prisma.$transaction(async (tx) => {
      await tx.batchJob.deleteMany({
        where: { data_source_id: id },
      });
      await tx.externalDataSource.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Fuente de datos eliminada exitosamente",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error deleting data source:", error);
    return NextResponse.json({ error: "Error al eliminar la fuente de datos" }, { status: 500 });
  }
}
