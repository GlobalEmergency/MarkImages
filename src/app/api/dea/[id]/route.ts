import { NextRequest, NextResponse } from 'next/server'
import ServiceProvider from '@/services/serviceProvider'
import { handleApiError, validateIdParam, createSuccessResponse } from '@/utils/apiUtils'

// Get the DEA service from the service provider
const deaService = ServiceProvider.getDeaService();

/**
 * GET handler for retrieving a specific DEA record by ID
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const { id, errorResponse } = validateIdParam(idParam);

		if (errorResponse) return errorResponse;

		const record = await deaService.getRecordById(id!);

		if (!record) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		return createSuccessResponse(record);
	} catch (error) {
		return handleApiError(error, 'Error al obtener registro');
	}
}

/**
 * PUT handler for updating a specific DEA record
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const { id, errorResponse } = validateIdParam(idParam);

		if (errorResponse) return errorResponse;

		// Verificar que el registro existe
		const existingRecord = await deaService.getRecordById(id!);
		if (!existingRecord) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		const data = await request.json();
		const record = await deaService.updateRecord(id!, data);

		return createSuccessResponse(record);
	} catch (error) {
		return handleApiError(error, 'Error al actualizar registro');
	}
}

/**
 * DELETE handler for removing a specific DEA record
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const { id, errorResponse } = validateIdParam(idParam);

		if (errorResponse) return errorResponse;

		// Verificar que el registro existe
		const existingRecord = await deaService.getRecordById(id!);
		if (!existingRecord) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		const record = await deaService.deleteRecord(id!);
		return createSuccessResponse({ success: true, deletedRecord: record });
	} catch (error) {
		return handleApiError(error, 'Error al eliminar registro');
	}
}
