/**
 * Import Template API
 *
 * GET /api/import/template - Download a CSV template with all import columns
 *
 * Query params:
 * - exampleRows: number (default: 2) — number of example rows with synthetic data
 *
 * Returns a CSV file ready for download with:
 * - All required and optional columns from the AED import schema
 * - Optional synthetic example rows to illustrate expected format
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBulkImportService } from "@/import/infrastructure/factories/createBulkImportService";

/**
 * GET /api/import/template
 * Download CSV import template
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const exampleRows = Math.min(
      Math.max(parseInt(searchParams.get("exampleRows") ?? "2", 10) || 0, 0),
      10 // Max 10 example rows
    );

    // Generate template CSV
    const service = getBulkImportService();
    const csvContent = service.generateTemplate({ exampleRows });

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla_importacion_dea.csv"',
        "Cache-Control": "public, max-age=3600", // Cache 1 hour
      },
    });
  } catch (error) {
    console.error("Error generating import template:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error al generar la plantilla",
      },
      { status: 500 }
    );
  }
}
