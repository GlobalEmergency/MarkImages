/**
 * Admin API para gestionar fuentes de datos externas
 * Solo accesible para usuarios con rol ADMIN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";

/**
 * GET /api/admin/data-sources
 * Lista todas las fuentes de datos externas
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (isActive !== null) {
      where.is_active = isActive === "true";
    }

    const dataSources = await prisma.externalDataSource.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: {
            batch_jobs: true,
            managed_aeds: true,
          },
        },
      },
    });

    // Formatear respuesta
    const formattedSources = dataSources.map((ds) => ({
      id: ds.id,
      name: ds.name,
      description: ds.description,
      type: ds.type,
      isActive: ds.is_active,
      matchingStrategy: ds.matching_strategy,
      matchingThreshold: ds.matching_threshold,
      syncFrequency: ds.sync_frequency,
      lastSyncAt: ds.last_sync_at,
      nextScheduledSyncAt: ds.next_scheduled_sync_at,
      autoDeactivateMissing: ds.auto_deactivate_missing,
      autoUpdateFields: ds.auto_update_fields,
      sourceOrigin: ds.source_origin,
      regionCode: ds.region_code,
      config: ds.config,
      totalRecordsSync: ds.total_records_sync,
      recordsCreated: ds.records_created,
      recordsUpdated: ds.records_updated,
      recordsDeactivated: ds.records_deactivated,
      stats: {
        batchJobs: ds._count.batch_jobs,
        managedAeds: ds._count.managed_aeds,
      },
      createdAt: ds.created_at,
      updatedAt: ds.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedSources,
      total: formattedSources.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching data sources:", error);
    return NextResponse.json({ error: "Error al obtener las fuentes de datos" }, { status: 500 });
  }
}

/**
 * POST /api/admin/data-sources
 * Crea una nueva fuente de datos externa
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();

    // Validar campos requeridos
    const requiredFields = ["name", "type", "sourceOrigin", "regionCode", "config"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `El campo '${field}' es requerido` }, { status: 400 });
      }
    }

    // Validar tipo
    const validTypes = ["CSV_FILE", "CKAN_API", "JSON_FILE", "REST_API"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Valores permitidos: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verificar nombre único
    const existing = await prisma.externalDataSource.findUnique({
      where: { name: body.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una fuente de datos con ese nombre" },
        { status: 409 }
      );
    }

    // Crear la fuente de datos
    const dataSource = await prisma.externalDataSource.create({
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type,
        config: body.config,
        matching_strategy: body.matchingStrategy || "HYBRID",
        matching_threshold: body.matchingThreshold || 75,
        is_active: body.isActive !== false,
        sync_frequency: body.syncFrequency || "MANUAL",
        default_publication_mode: body.defaultPublicationMode || "LOCATION_ONLY",
        auto_deactivate_missing: body.autoDeactivateMissing || false,
        auto_update_fields: body.autoUpdateFields || [],
        source_origin: body.sourceOrigin,
        region_code: body.regionCode,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type,
          isActive: dataSource.is_active,
          createdAt: dataSource.created_at,
        },
        message: "Fuente de datos creada exitosamente",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating data source:", error);
    return NextResponse.json({ error: "Error al crear la fuente de datos" }, { status: 500 });
  }
}
