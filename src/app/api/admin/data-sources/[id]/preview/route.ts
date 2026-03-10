/**
 * Admin API para previsualizar datos de una fuente externa
 * Solo accesible para usuarios con rol ADMIN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";
import { DataSourceAdapterFactory } from "@/import/infrastructure/adapters/DataSourceAdapterFactory";
import { buildDataSourceConfig } from "@/import/infrastructure/adapters/buildAdapterConfig";
import type { DataSourceType } from "@/import/domain/ports/IDataSourceAdapter";
import type { ImportRecord } from "@/import/domain/value-objects/ImportRecord";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/data-sources/[id]/preview
 * Obtiene una muestra de datos de la fuente externa
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Limitar el número de registros para preview
    const safeLimit = Math.min(Math.max(1, limit), 50);

    // Obtener la fuente de datos
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    // Crear adapter según el tipo
    const adapter = DataSourceAdapterFactory.getApiAdapter(dataSource.type as DataSourceType);

    // Construir configuración
    const configData = dataSource.config as Record<string, unknown>;
    const config = buildDataSourceConfig(dataSource.type as DataSourceType, configData);

    // Validar configuración
    const validation = await adapter.validateConfig(config);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Configuración inválida",
          issues: validation.getErrors().map((e) => e.toJSON()),
        },
        { status: 400 }
      );
    }

    // Probar conexión
    const connectionTest = await adapter.testConnection(config);
    if (!connectionTest.success) {
      return NextResponse.json(
        {
          error: "Error de conexión",
          message: connectionTest.message,
        },
        { status: 502 }
      );
    }

    // Obtener preview
    const records = await adapter.getPreview(config, safeLimit);

    // Formatear registros para la respuesta
    const formattedRecords = records.map((record: ImportRecord) => ({
      externalId: record.externalId,
      rowIndex: record.rowIndex,
      contentHash: record.contentHash,
      fields: {
        name: record.name,
        establishmentType: record.establishmentType,
        streetType: record.streetType,
        streetName: record.streetName,
        streetNumber: record.streetNumber,
        postalCode: record.postalCode,
        city: record.city,
        district: record.district,
        latitude: record.latitude,
        longitude: record.longitude,
        accessDescription: record.accessDescription,
        accessSchedule: record.accessSchedule,
      },
      hasCoordinates: record.hasCoordinates(),
      hasMinimumFields: record.hasMinimumRequiredFields(),
      missingFields: record.getMissingRequiredFields(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        dataSource: {
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type,
        },
        connection: {
          status: "connected",
          responseTimeMs: connectionTest.responseTimeMs,
          recordCount: connectionTest.recordCount,
        },
        preview: {
          limit: safeLimit,
          count: formattedRecords.length,
          records: formattedRecords,
        },
        fieldsSample: connectionTest.sampleFields,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching preview:", error);
    return NextResponse.json(
      {
        error: "Error al obtener preview",
        ...(process.env.NODE_ENV !== "production" && {
          details: error instanceof Error ? error.message : "Error desconocido",
        }),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data-sources/[id]/preview
 * Prueba la conexión con la fuente de datos
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // Obtener la fuente de datos
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    // Crear adapter según el tipo
    const adapter = DataSourceAdapterFactory.getApiAdapter(dataSource.type as DataSourceType);

    // Construir configuración
    const configData = dataSource.config as Record<string, unknown>;
    const config = buildDataSourceConfig(dataSource.type as DataSourceType, configData);

    // Probar conexión
    const result = await adapter.testConnection(config);

    return NextResponse.json({
      success: result.success,
      data: {
        connected: result.success,
        message: result.message,
        responseTimeMs: result.responseTimeMs,
        recordCount: result.recordCount,
        sampleFields: result.sampleFields,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error testing connection:", error);
    return NextResponse.json(
      {
        error: "Error al probar la conexión",
        ...(process.env.NODE_ENV !== "production" && {
          details: error instanceof Error ? error.message : "Error desconocido",
        }),
      },
      { status: 500 }
    );
  }
}
