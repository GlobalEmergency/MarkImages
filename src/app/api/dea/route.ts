import { NextRequest } from 'next/server'
import ServiceProvider from '@/services/serviceProvider'
import { handleApiError, createSuccessResponse } from '@/utils/apiUtils'

// Get the DEA service from the service provider
const deaService = ServiceProvider.getDeaService();

/**
 * GET handler for retrieving all DEA records
 */
export async function GET() {
	try {
		const records = await deaService.getAllRecords()
		return createSuccessResponse(records)
	} catch (error) {
		return handleApiError(error, 'Error al obtener registros')
	}
}

/**
 * POST handler for creating a new DEA record
 */
export async function POST(request: NextRequest) {
	try {
		const data = await request.json()
		const record = await deaService.createRecord(data)
		return createSuccessResponse(record, 201)
	} catch (error) {
		return handleApiError(error, 'Error al crear registro')
	}
}
