import { NextRequest, NextResponse } from 'next/server'
import { DeaRepository } from '@/repositories/deaRepository'

const deaRepository = new DeaRepository();

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const id = parseInt(idParam);

		if (isNaN(id)) {
			return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
		}

		const record = await deaRepository.findById(id);

		if (!record) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		return NextResponse.json(record);
	} catch (error) {
		console.error(`Error fetching DEA record:`, error);
		return NextResponse.json({ error: 'Error al obtener registro' }, { status: 500 });
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const id = parseInt(idParam);

		if (isNaN(id)) {
			return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
		}

		// Verificar que el registro existe
		const existingRecord = await deaRepository.findById(id);
		if (!existingRecord) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		const data = await request.json();
		const record = await deaRepository.update(id, data);

		return NextResponse.json(record);
	} catch (error) {
		console.error(`Error updating DEA record:`, error);
		return NextResponse.json({ error: 'Error al actualizar registro' }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const id = parseInt(idParam);

		if (isNaN(id)) {
			return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
		}

		// Verificar que el registro existe
		const existingRecord = await deaRepository.findById(id);
		if (!existingRecord) {
			return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
		}

		const record = await deaRepository.delete(id);
		return NextResponse.json({ success: true, deletedRecord: record });
	} catch (error) {
		console.error(`Error deleting DEA record:`, error);
		return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 });
	}
}
